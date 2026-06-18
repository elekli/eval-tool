'use client';

import { useState } from 'react';
import type { Run, Result, TestCase } from '@core/types';
import type { Summary, CaseSummary } from '@core/job/summary';
import { SummaryDashboard } from './SummaryDashboard';
import { ResultDrilldown } from './ResultDrilldown';

interface LoadResultsPayload {
  testCase: TestCase;
  results: Result[];
}

interface Props {
  run: Run;
  summary: Summary;
  loadResults: (testCaseId: string) => Promise<LoadResultsPayload>;
}

type DrillState =
  | { phase: 'idle' }
  | { phase: 'loading'; testCaseId: string }
  | { phase: 'loaded'; testCaseId: string; testCase: TestCase; results: Result[] }
  | { phase: 'error'; testCaseId: string; error: string };

export function RunView({ run, summary, loadResults }: Props) {
  const [drill, setDrill] = useState<DrillState>({ phase: 'idle' });

  async function handleCaseClick(cs: CaseSummary) {
    if (drill.phase === 'loaded' && drill.testCaseId === cs.testCaseId) {
      setDrill({ phase: 'idle' });
      return;
    }
    setDrill({ phase: 'loading', testCaseId: cs.testCaseId });
    try {
      const payload = await loadResults(cs.testCaseId);
      setDrill({ phase: 'loaded', testCaseId: cs.testCaseId, ...payload });
    } catch (err) {
      setDrill({ phase: 'error', testCaseId: cs.testCaseId, error: String(err) });
    }
  }

  const activeCaseId = drill.phase !== 'idle' ? drill.testCaseId : undefined;

  return (
    <div>
      {/* Run status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <RunStatusBadge status={run.status} />
        {run.error && (
          <span style={{ fontSize: 13, color: '#dc2626' }}>Error: {run.error}</span>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
          Run ID: {run.id}
        </span>
      </div>

      <SummaryDashboard
        summary={summary}
        onCaseClick={(cs) => void handleCaseClick(cs)}
        activeCaseId={activeCaseId}
      />

      {/* Drilldown panel */}
      {drill.phase === 'loading' && (
        <div style={{ marginTop: 16, padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          Loading results…
        </div>
      )}

      {drill.phase === 'error' && (
        <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
          Failed to load results: {drill.error}
        </div>
      )}

      {drill.phase === 'loaded' && (
        <ResultDrilldown
          testCase={drill.testCase}
          caseSummary={summary.cases.find((c) => c.testCaseId === drill.testCaseId)!}
          results={drill.results}
          onClose={() => setDrill({ phase: 'idle' })}
        />
      )}
    </div>
  );
}

function RunStatusBadge({ status }: { status: Run['status'] }) {
  const styles: Record<Run['status'], { bg: string; fg: string; label: string }> = {
    queued: { bg: '#e5e7eb', fg: '#374151', label: 'Queued' },
    running: { bg: '#dbeafe', fg: '#1e40af', label: 'Running…' },
    done: { bg: '#d1fae5', fg: '#065f46', label: 'Done' },
    error: { bg: '#fee2e2', fg: '#991b1b', label: 'Error' },
  };
  const s = styles[status];
  return (
    <span style={{ background: s.bg, color: s.fg, borderRadius: 4, padding: '3px 10px', fontWeight: 700, fontSize: 13 }}>
      {s.label}
    </span>
  );
}
