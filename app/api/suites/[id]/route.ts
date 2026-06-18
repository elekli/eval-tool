import { z } from 'zod/v4';
import { getContainer, LOCAL_OWNER } from '@app/lib/container';

const TargetConfigSchema = z.object({
  model: z.string(),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
  temperature: z.number().optional(),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.string(), z.unknown()),
  })).optional(),
});

const JudgeConfigSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
  rubric: z.string(),
}).nullable();

const RunConfigSchema = z.object({
  nRepeats: z.number().int().min(1),
});

const UpdateSuiteSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['behavior', 'tool_use']).optional(),
  target: TargetConfigSchema.optional(),
  judge: JudgeConfigSchema.optional(),
  runConfig: RunConfigSchema.optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const container = getContainer();
    const suite = container.repo.getSuite(id);
    if (!suite) return Response.json({ error: 'Not found' }, { status: 404 });
    if (suite.ownerId !== LOCAL_OWNER) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(suite);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const container = getContainer();
    const existing = container.repo.getSuite(id);
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
    if (existing.ownerId !== LOCAL_OWNER) return Response.json({ error: 'Not found' }, { status: 404 });

    const body: unknown = await req.json();
    const parsed = UpdateSuiteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }
    const data = parsed.data;
    const updated = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.target !== undefined ? { target: data.target } : {}),
      ...(data.judge !== undefined ? { judge: data.judge } : {}),
      ...(data.runConfig !== undefined ? { runConfig: data.runConfig } : {}),
    };
    container.repo.updateSuite(updated);
    return Response.json(updated);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const container = getContainer();
    const existing = container.repo.getSuite(id);
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
    if (existing.ownerId !== LOCAL_OWNER) return Response.json({ error: 'Not found' }, { status: 404 });
    container.repo.deleteSuite(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
