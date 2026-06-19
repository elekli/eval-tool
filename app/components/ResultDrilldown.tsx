'use client';

import type { Result, TestCase } from '@core/types';
import type { CaseSummary } from '@core/job/summary';
import { JudgePanel } from './JudgePanel';
import { ToolCallView } from './ToolCallView';

interface Props {
  testCase: TestCase;
  caseSummary: CaseSummary;
  results: Result[];
  onClose: () => void;
}

export function ResultDrilldown({ testCase, caseSummary, results, onClose }: Props) {
  const sortedResults = [...results].sort((a, b) => a.repeatIndex - b.repeatIndex);

  return (
    <div data-testid="drilldown" style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>
            {caseSummary.label}
          </h3>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Case ID: {testCase.id}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>

      {/* Vars */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Input Variables
        </div>
        {Object.entries(testCase.vars).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: '#374151', fontSize: 13, minWidth: 80 }}>{k}:</span>
            <span style={{ fontSize: 13, color: '#1f2937' }}>{v}</span>
          </div>
        ))}
        {testCase.expected?.tool && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>Expected Tool: </span>
            <span style={{ fontSize: 13, color: '#7c3aed', fontFamily: 'monospace' }}>{testCase.expected.tool}</span>
          </div>
        )}
      </div>

      {/* Repeats */}
      {sortedResults.length === 0 && (
        <div style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic', padding: 12, textAlign: 'center' }}>
          No results yet.
        </div>
      )}

      {sortedResults.map((result) => (
        <div
          key={result.id}
          style={{
            border: `1px solid ${result.status === 'error' ? '#fecaca' : '#e5e7eb'}`,
            borderRadius: 6,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{
            background: result.status === 'error' ? '#fef2f2' : '#f9fafb',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid #e5e7eb',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Repeat {result.repeatIndex + 1}
            </span>
            <StatusBadge status={result.status} />
            {result.usage && (
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                {result.usage.promptTokens + result.usage.completionTokens} tokens
                {result.usage.costUsd !== undefined && ` · $${result.usage.costUsd.toFixed(5)}`}
              </span>
            )}
          </div>

          <div style={{ padding: 12 }}>
            {result.status === 'error' ? (
              <div style={{ color: '#dc2626', fontSize: 13 }}>
                <strong>Error:</strong> {result.error ?? 'Unknown error'}
              </div>
            ) : result.toolCalls && result.toolCalls.length > 0 ? (
              <ToolCallView toolCalls={result.toolCalls} caseSummary={caseSummary} />
            ) : (
              <JudgePanel outputText={result.outputText} judgeVerdict={result.judgeVerdict} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    ok: { bg: '#d1fae5', fg: '#065f46' },
    error: { bg: '#fee2e2', fg: '#991b1b' },
  };
  const c = colors[status] ?? { bg: '#e5e7eb', fg: '#374151' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}
