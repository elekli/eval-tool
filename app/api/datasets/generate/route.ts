import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { getContainer } from '@app/lib/container';

const GenSpecSchema = z.object({
  languages: z.array(z.string()),
  countPerLang: z.number().int().min(1),
  lengthWords: z.number().int().min(1),
  topic: z.string(),
  extra: z.string().optional(),
});

const GeneratePreviewSchema = z.object({
  genSpec: GenSpecSchema,
  datasetId: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = GeneratePreviewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.message }, { status: 400 });
    }
    const { genSpec, datasetId } = parsed.data;
    const previewDatasetId = datasetId ?? randomUUID();
    const container = getContainer();
    const cases = await container.generator.generate(genSpec, previewDatasetId);
    return Response.json({ cases });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
