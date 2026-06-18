'use client';

import type { ToolCall } from '@core/types';
import type { CaseSummary } from '@core/job/summary';

interface Props {
  toolCalls: ToolCall[];
  caseSummary?: Pick<CaseSummary, 'toolSelectionEntropy' | 'toolSelectionHitRate' | 'argumentSchemaConformanceRate'>;
}

export function ToolCallView({ toolCalls, caseSummary }: Props) {
  if (toolCalls.length === 0) {
    return (
      <div style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic', padding: 12 }}>
        No tool calls recorded for this repeat.
      </div>
    );
  }

  return (
    <div>
      {/* Per-case metrics */}
      {caseSummary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Metric
            label="Selection Entropy"
            value={caseSummary.toolSelectionEntropy !== undefined ? caseSummary.toolSelectionEntropy.toFixed(3) : '—'}
            hint="Lower = more consistent tool choice"
          />
          <Metric
            label="Hit Rate"
            value={caseSummary.toolSelectionHitRate !== undefined ? `${(caseSummary.toolSelectionHitRate * 100).toFixed(0)}%` : '—'}
            hint="Correct tool selected"
          />
          <Metric
            label="Schema Conformance"
            value={caseSummary.argumentSchemaConformanceRate !== undefined ? `${(caseSummary.argumentSchemaConformanceRate * 100).toFixed(0)}%` : '—'}
            hint="Arguments matched JSON Schema"
          />
        </div>
      )}

      {/* Tool calls side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={colHeader}>Tool Call (Raw)</div>
          {toolCalls.map((tc, i) => (
            <div key={i} style={callBox}>
              <div style={callName}>{tc.name}</div>
              <pre style={codeStyle}>{tc.argumentsRaw}</pre>
            </div>
          ))}
        </div>
        <div>
          <div style={colHeader}>Parsed Arguments</div>
          {toolCalls.map((tc, i) => (
            <div key={i} style={callBox}>
              <div style={callName}>{tc.name}</div>
              {tc.argumentsParsed !== undefined ? (
                <pre style={codeStyle}>{JSON.stringify(tc.argumentsParsed, null, 2)}</pre>
              ) : (
                <span style={{ color: '#9ca3af', fontSize: 12 }}>Parse failed</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 14px', minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', lineHeight: 1.3 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{hint}</div>
    </div>
  );
}

const colHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
};

const callBox: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: 10,
  marginBottom: 8,
};

const callName: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#7c3aed',
  marginBottom: 6,
  fontFamily: 'monospace',
};

const codeStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: '#1f2937',
  fontFamily: 'monospace',
};
