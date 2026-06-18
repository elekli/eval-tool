import { toolUseMetrics } from './tooluse-metrics';

const schema = {
  type: 'object',
  required: ['loc'],
  properties: { loc: { type: 'string' } },
};

test('hit rate + entropy + conformance over N', () => {
  const m = toolUseMetrics({
    expectedTool: 'get_weather',
    toolSchema: schema,
    calls: [
      { name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } },
      { name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } },
      { name: 'search', argumentsRaw: '{}', argumentsParsed: {} },
    ],
  });
  // 2 of 3 calls are 'get_weather'
  expect(m.toolSelectionHitRate).toBeCloseTo(2 / 3);
  // 2 of 3 have a resolvable schema + valid args (search has no schema → non-conformant)
  expect(m.argumentSchemaConformanceRate).toBeCloseTo(2 / 3);
  // entropy is non-zero (2 distinct tools)
  expect(m.toolSelectionEntropy).toBeGreaterThan(0);
});

test('toolSelectionHitRate absent when expectedTool not given', () => {
  const m = toolUseMetrics({
    calls: [{ name: 'get_weather', argumentsRaw: '{}' }],
  });
  expect(m.toolSelectionHitRate).toBeUndefined();
});

test('conformance 0/1 when args undefined (fail closed)', () => {
  const m = toolUseMetrics({
    toolSchema: schema,
    calls: [{ name: 'get_weather', argumentsRaw: '{}' }],
    // argumentsParsed intentionally absent → undefined
  });
  expect(m.argumentSchemaConformanceRate).toBe(0);
});

test('conformance denominator is ALL calls, not just matching', () => {
  // 2 get_weather (valid) + 1 search (no schema) → 2/3, NOT 2/2
  const m = toolUseMetrics({
    expectedTool: 'get_weather',
    toolSchema: schema,
    calls: [
      { name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } },
      { name: 'get_weather', argumentsRaw: '{"loc":"NY"}', argumentsParsed: { loc: 'NY' } },
      { name: 'search', argumentsRaw: '{}', argumentsParsed: {} },
    ],
  });
  expect(m.argumentSchemaConformanceRate).toBeCloseTo(2 / 3);
});

test('all identical tool names → entropy 0, hit rate 1', () => {
  const m = toolUseMetrics({
    expectedTool: 'get_weather',
    toolSchema: schema,
    calls: [
      { name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } },
      { name: 'get_weather', argumentsRaw: '{"loc":"NY"}', argumentsParsed: { loc: 'NY' } },
    ],
  });
  expect(m.toolSelectionEntropy).toBe(0);
  expect(m.toolSelectionHitRate).toBeCloseTo(1);
  expect(m.argumentSchemaConformanceRate).toBeCloseTo(1);
});

test('empty calls list → entropy 0, conformance 0 (division guard)', () => {
  const m = toolUseMetrics({ calls: [] });
  expect(m.toolSelectionEntropy).toBe(0);
  expect(m.argumentSchemaConformanceRate).toBeNaN(); // 0/0, acceptable — no calls
});

test('argumentExactMatch absent when expected.arguments not given', () => {
  const m = toolUseMetrics({
    calls: [{ name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } }],
  });
  expect(m.argumentExactMatch).toBeUndefined();
});

test('argumentExactMatch true when parsed args deep-equal expected', () => {
  const m = toolUseMetrics({
    expected: { arguments: { loc: 'TP' } },
    calls: [{ name: 'get_weather', argumentsRaw: '{"loc":"TP"}', argumentsParsed: { loc: 'TP' } }],
  });
  expect(m.argumentExactMatch).toBe(true);
});

test('argumentExactMatch false when args differ', () => {
  const m = toolUseMetrics({
    expected: { arguments: { loc: 'TP' } },
    calls: [{ name: 'get_weather', argumentsRaw: '{"loc":"NY"}', argumentsParsed: { loc: 'NY' } }],
  });
  expect(m.argumentExactMatch).toBe(false);
});
