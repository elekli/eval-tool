// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunView } from './RunView';
import type { Run, Result, TestCase } from '@core/types';
import type { Summary } from '@core/job/summary';

const makeRun = (overrides: Partial<Run> = {}): Run => ({
  id: 'run-1',
  ownerId: 'local',
  suiteId: 'suite-1',
  datasetId: 'ds-1',
  status: 'done',
  nRepeats: 3,
  startedAt: Date.now() - 5000,
  finishedAt: Date.now(),
  error: null,
  ...overrides,
});

const makeSummary = (overrides: Partial<Summary> = {}): Summary => ({
  type: 'behavior',
  cases: [
    {
      testCaseId: 'tc-1',
      label: 'Hello world test',
      repeatCount: 3,
      errorCount: 0,
      scoreMean: 4.2,
      scoreStd: 0.3,
      distinctOutputCount: 2,
      isOutlier: false,
    },
    {
      testCaseId: 'tc-2',
      label: 'Edge case test',
      repeatCount: 3,
      errorCount: 1,
      scoreMean: 2.5,
      scoreStd: 1.5,
      distinctOutputCount: 3,
      isOutlier: true,
    },
  ],
  totalCostUsd: 0.0042,
  errorCount: 1,
  outliers: ['tc-2'],
  ...overrides,
});

const makeTestCase = (id: string): TestCase => ({
  id,
  datasetId: 'ds-1',
  vars: { input: 'Sample input text' },
});

const makeResults = (testCaseId: string): Result[] => [
  {
    id: 'res-1',
    runId: 'run-1',
    testCaseId,
    repeatIndex: 0,
    status: 'ok',
    outputText: 'This is the model output',
    judgeVerdict: { score: 4, reasoning: 'Good response overall.' },
    usage: { promptTokens: 100, completionTokens: 50, costUsd: 0.001 },
    createdAt: Date.now(),
  },
];

describe('RunView', () => {
  it('shows summary first without drilldown', () => {
    render(
      <RunView
        run={makeRun()}
        summary={makeSummary()}
        loadResults={vi.fn()}
      />,
    );

    // Summary content visible
    expect(screen.getByText('Hello world test')).toBeInTheDocument();
    expect(screen.getByText('Edge case test')).toBeInTheDocument();

    // Drilldown NOT visible
    expect(screen.queryByTestId('drilldown')).toBeNull();
  });

  it('reveals drilldown only after a case is clicked', async () => {
    const testCase = makeTestCase('tc-1');
    const results = makeResults('tc-1');

    const loadResults = vi.fn().mockResolvedValue({ testCase, results });

    render(
      <RunView
        run={makeRun()}
        summary={makeSummary()}
        loadResults={loadResults}
      />,
    );

    // Initially no drilldown
    expect(screen.queryByTestId('drilldown')).toBeNull();

    // Click the first case row
    fireEvent.click(screen.getByText('Hello world test'));

    // Drilldown appears
    await waitFor(() => {
      expect(screen.getByTestId('drilldown')).toBeInTheDocument();
    });

    expect(loadResults).toHaveBeenCalledWith('tc-1');
  });

  it('closes drilldown when Close is clicked', async () => {
    const testCase = makeTestCase('tc-1');
    const results = makeResults('tc-1');
    const loadResults = vi.fn().mockResolvedValue({ testCase, results });

    render(
      <RunView
        run={makeRun()}
        summary={makeSummary()}
        loadResults={loadResults}
      />,
    );

    fireEvent.click(screen.getByText('Hello world test'));

    await waitFor(() => {
      expect(screen.getByTestId('drilldown')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByTestId('drilldown')).toBeNull();
  });

  it('shows run status badge', () => {
    render(
      <RunView
        run={makeRun({ status: 'running' })}
        summary={makeSummary()}
        loadResults={vi.fn()}
      />,
    );
    expect(screen.getByText('Running…')).toBeInTheDocument();
  });

  it('shows error badge when run errored', () => {
    render(
      <RunView
        run={makeRun({ status: 'error', error: 'OpenRouter timeout' })}
        summary={makeSummary()}
        loadResults={vi.fn()}
      />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/OpenRouter timeout/)).toBeInTheDocument();
  });

  it('shows empty state when no cases', () => {
    render(
      <RunView
        run={makeRun()}
        summary={makeSummary({ cases: [], errorCount: 0, outliers: [] })}
        loadResults={vi.fn()}
      />,
    );
    expect(screen.getByText('No cases yet.')).toBeInTheDocument();
  });

  it('shows outlier badge on case row', () => {
    render(
      <RunView
        run={makeRun()}
        summary={makeSummary()}
        loadResults={vi.fn()}
      />,
    );
    // The outlier warning symbol ⚠ should be present
    expect(screen.getByTitle('Outlier')).toBeInTheDocument();
  });
});
