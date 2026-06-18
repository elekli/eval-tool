'use client';

import { useState } from 'react';
import type { VirtualToolDef } from '@core/types';

interface Props {
  tools: VirtualToolDef[];
  onChange: (tools: VirtualToolDef[]) => void;
}

const EMPTY_TOOL: VirtualToolDef = {
  name: '',
  description: '',
  parameters: { type: 'object', properties: {}, required: [] },
};

export function ToolSchemaEditor({ tools, onChange }: Props) {
  const [jsonErrors, setJsonErrors] = useState<Record<number, string>>({});

  function addTool() {
    onChange([...tools, { ...EMPTY_TOOL, parameters: { type: 'object', properties: {}, required: [] } }]);
  }

  function removeTool(idx: number) {
    onChange(tools.filter((_, i) => i !== idx));
    setJsonErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  function updateField(idx: number, field: keyof VirtualToolDef, value: string | Record<string, unknown>) {
    const updated = tools.map((t, i) => (i === idx ? { ...t, [field]: value } : t));
    onChange(updated);
  }

  function handleParametersChange(idx: number, raw: string) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      setJsonErrors((prev) => { const next = { ...prev }; delete next[idx]; return next; });
      updateField(idx, 'parameters', parsed);
    } catch {
      setJsonErrors((prev) => ({ ...prev, [idx]: 'Invalid JSON' }));
    }
  }

  return (
    <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '12px 16px', marginTop: 8 }}>
      <legend style={{ fontWeight: 600, fontSize: 13, color: '#374151', padding: '0 4px' }}>
        Virtual Tool Definitions
      </legend>

      {tools.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 8px' }}>
          No tools defined. Add at least one.
        </p>
      )}

      {tools.map((tool, idx) => (
        <div
          key={idx}
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>Tool {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeTool(idx)}
              style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>

          <label style={labelStyle}>
            Name
            <input
              style={inputStyle}
              value={tool.name}
              onChange={(e) => updateField(idx, 'name', e.target.value)}
              placeholder="e.g. get_weather"
            />
          </label>

          <label style={labelStyle}>
            Description
            <input
              style={inputStyle}
              value={tool.description}
              onChange={(e) => updateField(idx, 'description', e.target.value)}
              placeholder="What this tool does"
            />
          </label>

          <label style={labelStyle}>
            Parameters (JSON Schema)
            <textarea
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, minHeight: 80 }}
              defaultValue={JSON.stringify(tool.parameters, null, 2)}
              onChange={(e) => handleParametersChange(idx, e.target.value)}
            />
            {jsonErrors[idx] && (
              <span style={{ color: '#ef4444', fontSize: 12 }}>{jsonErrors[idx]}</span>
            )}
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addTool}
        style={{
          fontSize: 13,
          color: '#2563eb',
          background: 'none',
          border: '1px dashed #93c5fd',
          borderRadius: 4,
          padding: '6px 12px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        + Add Tool
      </button>
    </fieldset>
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
