import { getContainer, LOCAL_OWNER } from '@app/lib/container';

const TERMINAL_STATUSES = new Set(['done', 'error']);
const POLL_INTERVAL_MS = 500;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const container = getContainer();

  const run = container.repo.getRun(id);
  if (!run) return Response.json({ error: 'Not found' }, { status: 404 });
  if (run.ownerId !== LOCAL_OWNER) return Response.json({ error: 'Not found' }, { status: 404 });

  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: unknown) => {
        const text = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(text));
      };

      const poll = async () => {
        if (cancelled) return;

        const currentRun = container.repo.getRun(id);
        if (!currentRun) {
          encode({ error: 'Run disappeared' });
          controller.close();
          return;
        }
        const total = container.repo.listTestCases(currentRun.datasetId).length * currentRun.nRepeats;
        const done = container.repo.listResults(id).length;
        encode({ done, total, status: currentRun.status });

        if (TERMINAL_STATUSES.has(currentRun.status)) {
          controller.close();
          return;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        await poll();
      };

      await poll().catch((err) => {
        if (cancelled) return;
        try {
          encode({ error: String(err) });
          controller.close();
        } catch {
          // stream already closed
        }
      });
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
