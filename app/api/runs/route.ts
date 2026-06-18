import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { getContainer, LOCAL_OWNER } from '@app/lib/container';
import { JobRunner } from '@core/job/job-runner';

const CreateRunSchema = z.object({
  suiteId: z.string().min(1),
  datasetId: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = CreateRunSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }
    const { suiteId, datasetId } = parsed.data;
    const container = getContainer();

    // Validate suite and dataset exist
    const suite = container.repo.getSuite(suiteId);
    if (!suite) return Response.json({ error: `Suite not found: ${suiteId}` }, { status: 400 });
    const dataset = container.repo.getDataset(datasetId);
    if (!dataset) return Response.json({ error: `Dataset not found: ${datasetId}` }, { status: 400 });

    const run = {
      id: randomUUID(),
      ownerId: LOCAL_OWNER,
      suiteId,
      datasetId,
      status: 'queued' as const,
      nRepeats: suite.runConfig.nRepeats,
      startedAt: null,
      finishedAt: null,
      error: null,
    };
    container.repo.createRun(run);

    const jr = new JobRunner(container.repo, container.runner, container.judge);

    if (process.env.EVAL_SYNC_RUN === '1') {
      await jr.execute(run.id);
    } else {
      void jr.execute(run.id).catch(() => {
        // fire-and-forget; errors are persisted in the run record
      });
    }

    return Response.json({ id: run.id }, { status: 202 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
