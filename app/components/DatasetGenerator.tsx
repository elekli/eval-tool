'use client';

import { useState } from 'react';
import type { GenSpec, TestCase, Dataset } from '@core/types';

interface PreviewCase {
  id: string;
  datasetId: string;
  vars: Record<string, string>;
  expected?: { tool?: string; arguments?: Record<string, unknown> };
}

interface Props {
  onSaved: (dataset: Dataset) => void;
}

const DEFAULTS: GenSpec & { datasetName: string } = {
  datasetName: '',
  languages: ['English'],
  countPerLang: 5,
  lengthWords: 30,
  topic: '',
  extra: '',
};

export function DatasetGenerator({ onSaved }: Props) {
  const [spec, setSpec] = useState<typeof DEFAULTS>({ ...DEFAULTS });
  const [languagesRaw, setLanguagesRaw] = useState('English');
  const [preview, setPreview] = useState<PreviewCase[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) {
    setSpec((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setPreview(null);

    const genSpec: GenSpec = {
      languages: languagesRaw.split(',').map((s) => s.trim()).filter(Boolean),
      countPerLang: Number(spec.countPerLang),
      lengthWords: Number(spec.lengthWords),
      topic: spec.topic,
      extra: spec.extra || undefined,
    };

    try {
      const res = await fetch('/api/datasets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genSpec }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { cases } = (await res.json()) as { cases: PreviewCase[] };
      setPreview(cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function updateCase(idx: number, key: string, value: string) {
    if (!preview) return;
    setPreview(
      preview.map((c, i) =>
        i === idx ? { ...c, vars: { ...c.vars, [key]: value } } : c,
      ),
    );
  }

  function removeCase(idx: number) {
    if (!preview) return;
    setPreview(preview.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!preview || preview.length === 0) return;
    setSaving(true);
    setError(null);

    const genSpec: GenSpec = {
      languages: languagesRaw.split(',').map((s) => s.trim()).filter(Boolean),
      countPerLang: Number(spec.countPerLang),
      lengthWords: Number(spec.lengthWords),
      topic: spec.topic,
      extra: spec.extra || undefined,
    };

    const body = {
      name: spec.datasetName || `Generated: ${spec.topic}`,
      source: 'generated' as const,
      genSpec,
      cases: preview.map(({ id, vars, expected }) => ({ id, vars, expected })) as TestCase[],
    };

    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { dataset } = (await res.json()) as { dataset: Dataset };
      onSaved(dataset);
      setPreview(null);
      setSpec({ ...DEFAULTS });
      setLanguagesRaw('English');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <form onSubmit={(e) => void handleGenerate(e)} style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>
            Dataset Name
            <input
              style={inputStyle}
              value={spec.datasetName}
              onChange={(e) => set('datasetName', e.target.value)}
              placeholder="Leave blank to auto-name"
            />
          </label>

          <label style={labelStyle}>
            Topic
            <input
              style={inputStyle}
              required
              value={spec.topic}
              onChange={(e) => set('topic', e.target.value)}
              placeholder="e.g. customer support queries"
            />
          </label>

          <label style={labelStyle}>
            Languages (comma-separated)
            <input
              style={inputStyle}
              value={languagesRaw}
              onChange={(e) => setLanguagesRaw(e.target.value)}
              placeholder="English, Spanish, French"
            />
          </label>

          <label style={labelStyle}>
            Count per Language
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={50}
              value={spec.countPerLang}
              onChange={(e) => set('countPerLang', Number(e.target.value))}
            />
          </label>

          <label style={labelStyle}>
            Approx. Length (words)
            <input
              style={inputStyle}
              type="number"
              min={5}
              max={500}
              value={spec.lengthWords}
              onChange={(e) => set('lengthWords', Number(e.target.value))}
            />
          </label>

          <label style={labelStyle}>
            Extra Instructions
            <input
              style={inputStyle}
              value={spec.extra ?? ''}
              onChange={(e) => set('extra', e.target.value)}
              placeholder="Optional: tone, format, etc."
            />
          </label>
        </div>

        {error && (
          <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="submit"
            disabled={generating}
            style={primaryBtn(generating)}
          >
            {generating ? 'Generating…' : 'Generate Preview'}
          </button>

          {preview && preview.length > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              style={primaryBtn(saving, '#059669')}
            >
              {saving ? 'Saving…' : `Save Dataset (${preview.length} cases)`}
            </button>
          )}
        </div>
      </form>

      {preview && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Preview — {preview.length} cases
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={thStyle}>#</th>
                  {preview[0] && Object.keys(preview[0].vars).map((k) => (
                    <th key={k} style={thStyle}>{k}</th>
                  ))}
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c, idx) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>{idx + 1}</td>
                    {Object.entries(c.vars).map(([k, v]) => (
                      <td key={k} style={{ ...tdStyle, minWidth: 200 }}>
                        <textarea
                          style={{ width: '100%', minHeight: 60, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: 4, resize: 'vertical', boxSizing: 'border-box' }}
                          value={v}
                          onChange={(e) => updateCase(idx, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => removeCase(idx)}
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
        </div>
      )}
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

function primaryBtn(disabled: boolean, bg = '#2563eb'): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  };
}
