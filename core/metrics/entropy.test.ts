import { shannonEntropy, toolSelectionEntropy } from './entropy';

test('entropy 0 when all identical', () => {
  expect(toolSelectionEntropy(['a', 'a', 'a'])).toBe(0);
});

test('entropy max for uniform 2-way', () => {
  expect(toolSelectionEntropy(['a', 'b'])).toBeCloseTo(1); // 1 bit
});

test('entropy handles empty as 0', () => {
  expect(toolSelectionEntropy([])).toBe(0);
});

test('shannonEntropy on uniform 4-way is 2 bits', () => {
  expect(shannonEntropy({ a: 1, b: 1, c: 1, d: 1 })).toBeCloseTo(2);
});

test('shannonEntropy on single element is 0', () => {
  expect(shannonEntropy({ only: 5 })).toBe(0);
});

test('toolSelectionEntropy single tool is 0', () => {
  expect(toolSelectionEntropy(['x'])).toBe(0);
});
