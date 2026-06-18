import { getContainer, LOCAL_OWNER } from '@app/lib/container';

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
    const results = container.repo.listResults(id);
    const cases = container.repo.listTestCases(run.datasetId);
    return Response.json({ run, results, cases });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
