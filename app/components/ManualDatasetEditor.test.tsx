// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Suite } from '@core/types';
import { ManualDatasetEditor } from './ManualDatasetEditor';

function makeSuite(overrides: Partial<Suite> = {}): Suite {
  return {
    id: 'suite-1',
    ownerId: 'local',
    name: 'S',
    type: 'behavior',
    target: {
      model: 'openai/gpt-4o-mini',
      systemPrompt: '',
      userPromptTemplate: '{{input}}',
      temperature: 0.7,
    },
    judge: null,
    runConfig: { nRepeats: 3 },
    createdAt: 0,
    ...overrides,
  };
}

const toolSuite = (): Suite =>
  makeSuite({
    type: 'tool_use',
    target: {
      model: 'openai/gpt-4o-mini',
      systemPrompt: '',
      userPromptTemplate: '{{input}}',
      temperature: 0.7,
      tools: [
        { name: 'search_entity', description: '', parameters: {} },
        { name: 'query_sql', description: '', parameters: {} },
      ],
    },
  });

function mockFetchOk() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ dataset: { id: 'd1', name: 'X', source: 'manual', ownerId: 'local', createdAt: 0 } }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastPostBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe('ManualDatasetEditor', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('derives variable columns from the suite template', () => {
    render(<ManualDatasetEditor suite={makeSuite({ target: { ...makeSuite().target, userPromptTemplate: '{{question}} / {{lang}}' } })} onSaved={vi.fn()} />);
    expect(screen.getByRole('columnheader', { name: 'question' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'lang' })).toBeInTheDocument();
  });

  it('shows the Expected tool column only for tool_use suites', () => {
    const { unmount } = render(<ManualDatasetEditor suite={makeSuite()} onSaved={vi.fn()} />);
    expect(screen.queryByRole('columnheader', { name: /expected tool/i })).toBeNull();
    unmount();
    render(<ManualDatasetEditor suite={toolSuite()} onSaved={vi.fn()} />);
    expect(screen.getByRole('columnheader', { name: /expected tool/i })).toBeInTheDocument();
  });

  it('omits expected when no tool is selected (observe-only)', async () => {
    const fetchMock = mockFetchOk();
    render(<ManualDatasetEditor suite={toolSuite()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /input for case 1/i }), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: /save dataset/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = lastPostBody(fetchMock);
    expect(body.source).toBe('manual');
    expect(body.cases[0].vars).toEqual({ input: 'hi' });
    expect(body.cases[0].expected).toBeUndefined();
  });

  it('saves expected.tool when a tool is selected', async () => {
    const fetchMock = mockFetchOk();
    render(<ManualDatasetEditor suite={toolSuite()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /input for case 1/i }), { target: { value: 'who donated' } });
    fireEvent.change(screen.getByRole('combobox', { name: /expected tool for case 1/i }), { target: { value: 'query_sql' } });
    fireEvent.click(screen.getByRole('button', { name: /save dataset/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(lastPostBody(fetchMock).cases[0].expected).toEqual({ tool: 'query_sql' });
  });

  it('adds and removes case rows', () => {
    render(<ManualDatasetEditor suite={makeSuite()} onSaved={vi.fn()} />);
    expect(screen.getAllByRole('textbox', { name: /input for case/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /\+ add case/i }));
    expect(screen.getAllByRole('textbox', { name: /input for case/i })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /remove case/i })[0]!);
    expect(screen.getAllByRole('textbox', { name: /input for case/i })).toHaveLength(1);
  });

  it('refuses to save when all cases are empty', () => {
    const fetchMock = mockFetchOk();
    render(<ManualDatasetEditor suite={makeSuite()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save dataset/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/add at least one case/i)).toBeInTheDocument();
  });
});
