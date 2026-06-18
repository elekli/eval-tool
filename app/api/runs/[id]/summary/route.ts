import { getContainer, LOCAL_OWNER } from '@app/lib/container';
import { computeSummary } from '@core/job/summary';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const container = getContainer();
    const run = container.repo.getRun(id);
    if (!run) return Response.json({ error: 'Not found' }, { status: 404 });
    if (run.ownerId !== LOCAL_OWNER) return Response.json({ error: 'Not found' }, { status: 404 });

    const suite = container.repo.getSuite(run.suiteId);
    if (!suite) return Response.json({ error: `Suite not found: ${run.suiteId}` }, { status: 400 });

    const cases = container.repo.listTestCases(run.datasetId);
    const results = container.repo.listResults(id);
    const summary = computeSummary(suite.type, cases, results, suite.target.tools);
    return Response.json(summary);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
