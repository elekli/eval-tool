import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { getContainer, LOCAL_OWNER } from '@app/lib/container';
import { JobRunner } from '@core/job/job-runner';
import { extractPlaceholders } from '@core/runner/template';

const CreateRunSchema = z.object({
  suiteId: z.string().min(1),
  datasetId: z.string().min(1),
});

// GET /api/runs?suiteId=... — list runs for a suite, newest first.
export function GET(req: Request): Response {
  try {
    const suiteId = new URL(req.url).searchParams.get('suiteId');
    if (!suiteId) {
      return Response.json({ error: 'suiteId query parameter is required' }, { status: 400 });
    }
    const runs = getContainer().repo.listRunsBySuite(suiteId);
    return Response.json(runs);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

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

    // Fail fast (before spending any API tokens) on a template/dataset variable mismatch.
    // This is the user-facing guard against the silent empty-substitution that made models
    // receive an empty prompt; renderTemplate also throws as defense-in-depth.
    const cases = container.repo.listTestCases(datasetId);
    if (cases.length === 0) {
      return Response.json({ error: `Dataset has no test cases: ${datasetId}` }, { status: 400 });
    }
    const placeholders = extractPlaceholders(suite.target.userPromptTemplate);
    if (placeholders.length > 0) {
      const missing = new Set<string>();
      for (const c of cases) {
        for (const p of placeholders) if (!(p in c.vars)) missing.add(p);
      }
      if (missing.size > 0) {
        const available = [...new Set(cases.flatMap((c) => Object.keys(c.vars)))];
        return Response.json(
          {
            error:
              `User prompt template references variable(s) not in the dataset: ${[...missing].join(', ')}. ` +
              `Available dataset variables: ${available.length ? available.join(', ') : '(none)'}. ` +
              `Edit the suite's user prompt template to match, or pick a dataset that provides these variables.`,
          },
          { status: 400 },
        );
      }
    }

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
