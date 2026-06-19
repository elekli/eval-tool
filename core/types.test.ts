import type { Suite } from './types';
test('Suite shape compiles', () => {
  const s: Suite = { id: 'x', ownerId: 'local', name: 'n', type: 'behavior',
    target: { model: 'm', systemPrompt: 's', userPromptTemplate: '{{a}}' },
    judge: null, runConfig: { nRepeats: 3 }, createdAt: 0 };
  expect(s.type).toBe('behavior');
});
