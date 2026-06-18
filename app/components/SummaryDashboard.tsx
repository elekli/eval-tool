'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Summary, CaseSummary } from '@core/job/summary';

interface Props {
  summary: Summary;
  onCaseClick: (cs: CaseSummary) => void;
  activeCaseId?: string;
}

export function SummaryDashboard({ summary, onCaseClick, activeCaseId }: Props) {
  const { type, cases, totalCostUsd, errorCount, outliers } = summary;

  // Build distribution data
  const distData = buildDistribution(type, cases);

  return (
    <div>
      {/* Top-level stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Cases" value={String(cases.length)} />
        <StatCard label="Total Errors" value={String(errorCount)} accent={errorCount > 0 ? '#dc2626' : undefined} />
        <StatCard label="Outliers" value={String(outliers.length)} accent={outliers.length > 0 ? '#d97706' : undefined} />
        <StatCard
          label="Total Cost"
          value={totalCostUsd > 0 ? `$${totalCostUsd.toFixed(4)}` : '—'}
        />
        {type === 'behavior' && (
          <StatCard
            label="Avg Score"
            value={avgScore(cases) ?? '—'}
          />
        )}
        {type === 'tool_use' && (
          <StatCard
            label="Avg Hit Rate"
            value={avgHitRate(cases) ?? '—'}
          />
        )}
      </div>

      {/* Distribution chart */}
      {distData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={sectionLabel}>
            {type === 'behavior' ? 'Score Distribution' : 'Tool Selection Entropy Distribution'}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={distData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(val) => [val, 'Cases']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {distData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Case list */}
      <div>
        <div style={sectionLabel}>Cases — click to drill down</div>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={thStyle}>Case</th>
                {type === 'behavior' && (
                  <>
                    <th style={thStyle}>Score (mean)</th>
                    <th style={thStyle}>Std Dev</th>
                    <th style={thStyle}>Distinct</th>
                  </>
                )}
                {type === 'tool_use' && (
                  <>
                    <th style={thStyle}>Entropy</th>
                    <th style={thStyle}>Hit Rate</th>
                    <th style={thStyle}>Conformance</th>
                  </>
                )}
                <th style={thStyle}>Repeats</th>
                <th style={thStyle}>Errors</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((cs) => {
                const isActive = cs.testCaseId === activeCaseId;
                const isOutlier = cs.isOutlier;
                return (
                  <tr
                    key={cs.testCaseId}
                    onClick={() => onCaseClick(cs)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCaseClick(cs); } }}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: isActive ? '#eff6ff' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isActive ? '#eff6ff' : 'transparent'; }}
                  >
                    <td style={{ ...tdStyle, maxWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isOutlier && (
                          <span title="Outlier" style={{ color: '#d97706', fontSize: 14 }}>⚠</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cs.label}
                        </span>
                      </div>
                    </td>
                    {type === 'behavior' && (
                      <>
                        <td style={tdStyle}>
                          {cs.scoreMean !== undefined ? (
                            <ScorePill score={cs.scoreMean} />
                          ) : '—'}
                        </td>
                        <td style={tdStyle}>
                          {cs.scoreStd !== undefined ? cs.scoreStd.toFixed(2) : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#6b7280' }}>
                          {cs.distinctOutputCount ?? '—'}
                        </td>
                      </>
                    )}
                    {type === 'tool_use' && (
                      <>
                        <td style={tdStyle}>
                          {cs.toolSelectionEntropy !== undefined ? cs.toolSelectionEntropy.toFixed(3) : '—'}
                        </td>
                        <td style={tdStyle}>
                          {cs.toolSelectionHitRate !== undefined ? `${(cs.toolSelectionHitRate * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td style={tdStyle}>
                          {cs.argumentSchemaConformanceRate !== undefined ? `${(cs.argumentSchemaConformanceRate * 100).toFixed(0)}%` : '—'}
                        </td>
                      </>
                    )}
                    <td style={{ ...tdStyle, color: '#6b7280' }}>{cs.repeatCount}</td>
                    <td style={{ ...tdStyle, color: cs.errorCount > 0 ? '#dc2626' : '#9ca3af' }}>
                      {cs.errorCount > 0 ? cs.errorCount : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: '#2563eb', fontSize: 12 }}>View →</td>
                  </tr>
                );
              })}

              {cases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, color: '#9ca3af', textAlign: 'center', padding: 24, fontStyle: 'italic' }}>
                    No cases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 14px', minWidth: 100 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#1f2937', lineHeight: 1.3 }}>{value}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const rounded = Math.round(score * 10) / 10;
  let bg = '#d1fae5', fg = '#065f46';
  if (score < 3) { bg = '#fee2e2'; fg = '#991b1b'; }
  else if (score < 4) { bg = '#fef3c7'; fg = '#92400e'; }
  return (
    <span style={{ background: bg, color: fg, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 12 }}>
      {rounded}
    </span>
  );
}

function avgScore(cases: CaseSummary[]): string | null {
  const scores = cases.map((c) => c.scoreMean).filter((s): s is number => s !== undefined);
  if (scores.length === 0) return null;
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
}

function avgHitRate(cases: CaseSummary[]): string | null {
  const rates = cases.map((c) => c.toolSelectionHitRate).filter((r): r is number => r !== undefined);
  if (rates.length === 0) return null;
  return `${((rates.reduce((a, b) => a + b, 0) / rates.length) * 100).toFixed(0)}%`;
}

function buildDistribution(type: string, cases: CaseSummary[]): { label: string; count: number; fill: string }[] {
  if (type === 'behavior') {
    // Score buckets 1-5
    const buckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const c of cases) {
      if (c.scoreMean === undefined) continue;
      const bucket = String(Math.round(c.scoreMean));
      if (bucket in buckets) buckets[bucket]!++;
    }
    const fills = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'];
    return Object.entries(buckets).map(([label, count], i) => ({
      label,
      count,
      fill: fills[i] ?? '#94a3b8',
    }));
  } else {
    // Entropy buckets 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8+
    const buckets = [
      { label: '0–0.2', min: 0, max: 0.2, count: 0 },
      { label: '0.2–0.4', min: 0.2, max: 0.4, count: 0 },
      { label: '0.4–0.6', min: 0.4, max: 0.6, count: 0 },
      { label: '0.6–0.8', min: 0.6, max: 0.8, count: 0 },
      { label: '0.8+', min: 0.8, max: Infinity, count: 0 },
    ];
    for (const c of cases) {
      if (c.toolSelectionEntropy === undefined) continue;
      const b = buckets.find((bk) => c.toolSelectionEntropy! >= bk.min && c.toolSelectionEntropy! < bk.max);
      if (b) b.count++;
    }
    const fills = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
    return buckets.map((b, i) => ({ label: b.label, count: b.count, fill: fills[i] ?? '#94a3b8' }));
  }
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  borderBottom: '1px solid #d1d5db',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'middle',
};
