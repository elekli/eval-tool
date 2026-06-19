import { validArguments } from './schema-conformance';

const schema = {
  type: 'object',
  required: ['loc'],
  properties: { loc: { type: 'string' } },
};

test('valid args pass', () => {
  expect(validArguments(schema, { loc: 'TP' })).toBe(true);
});

test('missing required fails', () => {
  expect(validArguments(schema, {})).toBe(false);
});

test('unparsed args (undefined) fail closed', () => {
  expect(validArguments(schema, undefined)).toBe(false);
});

test('wrong type fails', () => {
  expect(validArguments(schema, { loc: 42 })).toBe(false);
});

test('extra properties still valid (schema does not use additionalProperties:false)', () => {
  expect(validArguments(schema, { loc: 'TP', extra: 'ok' })).toBe(true);
});

test('null args fail closed', () => {
  expect(validArguments(schema, null)).toBe(false);
});
