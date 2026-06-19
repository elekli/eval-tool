'use client';

import type { JudgeVerdict } from '@core/types';

interface Props {
  outputText: string | undefined;
  judgeVerdict: JudgeVerdict | undefined;
}

export function JudgePanel({ outputText, judgeVerdict }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}
    >
      {/* Model Output */}
      <div>
        <div style={panelHeader}>Model Output</div>
        <div style={panelBody}>
          {outputText ? (
            <pre style={preStyle}>{outputText}</pre>
          ) : (
            <span style={emptyText}>No text output</span>
          )}
        </div>
      </div>

      {/* Judge Assessment */}
      <div>
        <div style={panelHeader}>Judge Assessment</div>
        <div style={panelBody}>
          {judgeVerdict ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Score
                </span>
                <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor(judgeVerdict.score), lineHeight: 1.2, marginTop: 2 }}>
                  {judgeVerdict.score}
                  <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 400 }}> / 5</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Reasoning
                </span>
                <p style={{ fontSize: 13, color: '#374151', marginTop: 6, lineHeight: 1.6 }}>
                  {judgeVerdict.reasoning}
                </p>
              </div>
            </>
          ) : (
            <span style={emptyText}>No judge verdict</span>
          )}
        </div>
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 4) return '#059669';
  if (score >= 3) return '#d97706';
  return '#dc2626';
}

const panelHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '8px 12px',
  background: '#f9fafb',
  borderRadius: '6px 6px 0 0',
  border: '1px solid #e5e7eb',
  borderBottom: 'none',
};

const panelBody: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '0 0 6px 6px',
  padding: 12,
  background: '#fff',
  minHeight: 100,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#1f2937',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'inherit',
};

const emptyText: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: 13,
  fontStyle: 'italic',
};
