import { scoreStats, distinctOutputs } from './behavior-metrics';

test('scoreStats mean+std', () => {
  expect(scoreStats([4, 4, 4])).toEqual({ mean: 4, std: 0, n: 3 });
});

test('scoreStats population std (not sample)', () => {
  // [2, 4]: mean=3, pop_variance=((2-3)^2+(4-3)^2)/2=1, pop_std=1
  const result = scoreStats([2, 4]);
  expect(result.mean).toBeCloseTo(3);
  expect(result.std).toBeCloseTo(1);
  expect(result.n).toBe(2);
});

test('scoreStats single value has std 0', () => {
  expect(scoreStats([7])).toEqual({ mean: 7, std: 0, n: 1 });
});

test('distinctOutputs normalises whitespace/case', () => {
  expect(distinctOutputs([' Hi ', 'hi', 'HI'])).toBe(1);
});

test('distinctOutputs counts genuinely different', () => {
  expect(distinctOutputs(['a', 'b', 'a'])).toBe(2);
});

test('distinctOutputs handles empty array', () => {
  expect(distinctOutputs([])).toBe(0);
});

test('distinctOutputs collapses internal whitespace', () => {
  expect(distinctOutputs(['hello  world', 'hello world'])).toBe(1);
});
