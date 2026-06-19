import { test, expect } from 'vitest';
import { extractPlaceholders, renderTemplate, MissingTemplateVarError } from './template';

test('extractPlaceholders returns distinct names in first-seen order', () => {
  expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  expect(extractPlaceholders('no placeholders here')).toEqual([]);
});

test('renderTemplate substitutes present vars', () => {
  expect(renderTemplate('Title: {{input}}', { input: '談世足' })).toBe('Title: 談世足');
});

test('renderTemplate substitutes a present-but-empty var (legitimate empty data)', () => {
  expect(renderTemplate('[{{input}}]', { input: '' })).toBe('[]');
});

test('renderTemplate THROWS on a missing var (no silent empty substitution)', () => {
  // This is the regression guard: {{input}} against an article-only row used to
  // silently render '' and send an empty prompt to the model.
  expect(() => renderTemplate('{{input}}', { article: 'x' })).toThrow(MissingTemplateVarError);
});

test('MissingTemplateVarError names the missing and available variables', () => {
  try {
    renderTemplate('{{input}} {{lang}}', { article: 'x' });
    throw new Error('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(MissingTemplateVarError);
    const e = err as MissingTemplateVarError;
    expect(e.missing).toEqual(['input', 'lang']);
    expect(e.available).toEqual(['article']);
    expect(e.message).toContain('input');
    expect(e.message).toContain('article');
  }
});
