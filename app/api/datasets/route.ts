import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { getContainer, LOCAL_OWNER } from '@app/lib/container';

const TestCaseSchema = z.object({
  id: z.string().optional(),
  datasetId: z.string().optional(),
  vars: z.record(z.string(), z.string()),
  expected: z.object({
    tool: z.string().optional(),
    arguments: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

const GenSpecSchema = z.object({
  languages: z.array(z.string()),
  countPerLang: z.number().int().min(1),
  lengthWords: z.number().int().min(1),
  topic: z.string(),
  extra: z.string().optional(),
});

const CreateDatasetSchema = z.object({
  name: z.string().min(1),
  source: z.enum(['manual', 'generated']),
  genSpec: GenSpecSchema.optional(),
  cases: z.array(TestCaseSchema),
});

export async function GET(_req: Request): Promise<Response> {
  try {
    const container = getContainer();
    const datasets = container.repo.listDatasets(LOCAL_OWNER);
    return Response.json(datasets);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = CreateDatasetSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }
    const data = parsed.data;
    const container = getContainer();
    const datasetId = randomUUID();
    const dataset = {
      id: datasetId,
      ownerId: LOCAL_OWNER,
      name: data.name,
      source: data.source,
      genSpec: data.genSpec,
      createdAt: Date.now(),
    };
    const cases = data.cases.map((c) => ({
      id: c.id ?? randomUUID(),
      datasetId,
      vars: c.vars,
      expected: c.expected,
    }));
    container.repo.createDataset(dataset, cases);
    return Response.json({ dataset, cases }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
