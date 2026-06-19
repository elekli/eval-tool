'use client';

import { useMemo, useState } from 'react';
import type { Dataset, Suite, TestCase } from '@core/types';
import { extractPlaceholders } from '@core/runner/template';

interface Props {
  suite: Suite;
  onSaved: (dataset: Dataset) => void;
}

interface Row {
  vars: Record<string, string>;
  expectedTool: string; // '' means observe-only (no expected.tool)
}

export function ManualDatasetEditor({ suite, onSaved }: Props) {
  // Variable columns come straight from the suite's template, so authored cases
  // are guaranteed to match the placeholders the runner will substitute.
  // A template with no {{vars}} still needs somewhere to type content → default to `input`.
  const varNames = useMemo(() => {
    const found = extractPlaceholders(suite.target.userPromptTemplate);
    return found.length > 0 ? found : ['input'];
  }, [suite.target.userPromptTemplate]);

  const toolNames = useMemo(
    () => (suite.type === 'tool_use' ? (suite.target.tools ?? []).map((t) => t.name) : []),
    [suite],
  );
  const showToolColumn = toolNames.length > 0;

  const emptyRow = (): Row => ({
    vars: Object.fromEntries(varNames.map((n) => [n, ''])),
    expectedTool: '',
  });

  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVar(idx: number, varName: string, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, vars: { ...r.vars, [varName]: value } } : r)));
  }

  function updateTool(idx: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, expectedTool: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError(null);

    // Drop fully-empty rows; a case with no content is meaningless.
    const cases: TestCase[] = rows
      .filter((r) => varNames.some((n) => r.vars[n]?.trim()))
      .map((r) => ({
        vars: Object.fromEntries(varNames.map((n) => [n, r.vars[n] ?? ''])),
        ...(r.expectedTool ? { expected: { tool: r.expectedTool } } : {}),
      })) as TestCase[];

    if (cases.length === 0) {
      setError('Add at least one case with content before saving.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Manual dataset', source: 'manual', cases }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { dataset } = (await res.json()) as { dataset: Dataset };
      onSaved(dataset);
      setName('');
      setRows([emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label style={labelStyle}>
        Dataset Name
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Leave blank to auto-name"
        />
      </label>

      {showToolColumn && (
        <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 8px' }}>
          Expected tool is optional — leave it as <em>(none)</em> to just observe which tool the model picks
          (hit-rate stays blank for that case).
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={thStyle}>#</th>
              {varNames.map((n) => (
                <th key={n} style={thStyle}>{n}</th>
              ))}
              {showToolColumn && <th style={thStyle}>Expected tool</th>}
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={tdStyle}>{idx + 1}</td>
                {varNames.map((n) => (
                  <td key={n} style={{ ...tdStyle, minWidth: 200 }}>
                    <textarea
                      aria-label={`${n} for case ${idx + 1}`}
                      style={{ width: '100%', minHeight: 60, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: 4, resize: 'vertical', boxSizing: 'border-box' }}
                      value={row.vars[n] ?? ''}
                      onChange={(e) => updateVar(idx, n, e.target.value)}
                    />
                  </td>
                ))}
                {showToolColumn && (
                  <td style={{ ...tdStyle, minWidth: 160 }}>
                    <select
                      aria-label={`Expected tool for case ${idx + 1}`}
                      style={{ ...inputStyle, padding: '6px 8px' }}
                      value={row.expectedTool}
                      onChange={(e) => updateTool(idx, e.target.value)}
                    >
                      <option value="">(none — observe only)</option>
                      {toolNames.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                )}
                <td style={tdStyle}>
                  <button
                    type="button"
                    aria-label={`Remove case ${idx + 1}`}
                    onClick={() => removeRow(idx)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '8px 12px', fontSize: 13, margin: '12px 0' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={addRow}
          style={{ fontSize: 13, color: '#2563eb', background: 'none', border: '1px dashed #93c5fd', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
        >
          + Add Case
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          style={{
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Dataset'}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
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
  verticalAlign: 'top',
};
