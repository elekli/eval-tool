import { randomUUID } from 'crypto';
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

const CreateSuiteSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['behavior', 'tool_use']),
  target: TargetConfigSchema,
  judge: JudgeConfigSchema,
  runConfig: RunConfigSchema,
});

export async function GET(_req: Request): Promise<Response> {
  try {
    const container = getContainer();
    const suites = container.repo.listSuites(LOCAL_OWNER);
    return Response.json(suites);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = CreateSuiteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }
    const data = parsed.data;
    const container = getContainer();
    const suite = {
      id: randomUUID(),
      ownerId: LOCAL_OWNER,
      name: data.name,
      type: data.type,
      target: data.target,
      judge: data.judge,
      runConfig: data.runConfig,
      createdAt: Date.now(),
    };
    container.repo.createSuite(suite);
    return Response.json(suite, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
