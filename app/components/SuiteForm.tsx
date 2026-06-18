'use client';

import { useState } from 'react';
import type { Suite, EvalType, VirtualToolDef } from '@core/types';
import { ToolSchemaEditor } from './ToolSchemaEditor';

interface SuiteFormValues {
  name: string;
  type: EvalType;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: string;
  nRepeats: string;
  judgeEnabled: boolean;
  judgeModel: string;
  judgeRubric: string;
  tools: VirtualToolDef[];
}

interface Props {
  initial?: Suite;
  onSaved: (suite: Suite) => void;
}

const DEFAULTS: SuiteFormValues = {
  name: '',
  type: 'behavior',
  model: 'openai/gpt-4o-mini',
  systemPrompt: '',
  userPromptTemplate: '{{input}}',
  temperature: '0.7',
  nRepeats: '3',
  judgeEnabled: false,
  judgeModel: 'openai/gpt-4o-mini',
  judgeRubric: '',
  tools: [],
};

function suiteToValues(s: Suite): SuiteFormValues {
  return {
    name: s.name,
    type: s.type,
    model: s.target.model,
    systemPrompt: s.target.systemPrompt,
    userPromptTemplate: s.target.userPromptTemplate,
    temperature: String(s.target.temperature ?? 0.7),
    nRepeats: String(s.runConfig.nRepeats),
    judgeEnabled: s.judge?.enabled ?? false,
    judgeModel: s.judge?.model ?? 'openai/gpt-4o-mini',
    judgeRubric: s.judge?.rubric ?? '',
    tools: s.target.tools ?? [],
  };
}

export function SuiteForm({ initial, onSaved }: Props) {
  const [values, setValues] = useState<SuiteFormValues>(
    initial ? suiteToValues(initial) : DEFAULTS,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SuiteFormValues>(key: K, value: SuiteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name: values.name,
      type: values.type,
      target: {
        model: values.model,
        systemPrompt: values.systemPrompt,
        userPromptTemplate: values.userPromptTemplate,
        temperature: parseFloat(values.temperature) || 0.7,
        ...(values.type === 'tool_use' ? { tools: values.tools } : {}),
      },
      judge: values.judgeEnabled
        ? { enabled: true, model: values.judgeModel, rubric: values.judgeRubric }
        : null,
      runConfig: { nRepeats: parseInt(values.nRepeats, 10) || 3 },
    };

    try {
      const url = initial ? `/api/suites/${initial.id}` : '/api/suites';
      const method = initial ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const suite = (await res.json()) as Suite;
      onSaved(suite);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ maxWidth: 640 }}>
      <div style={fieldGroup}>
        <label style={labelStyle}>
          Suite Name
          <input
            style={inputStyle}
            required
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Customer Support Eval"
          />
        </label>

        <label style={labelStyle}>
          Eval Type
          <select
            style={inputStyle}
            value={values.type}
            onChange={(e) => set('type', e.target.value as EvalType)}
          >
            <option value="behavior">Behavior (text output)</option>
            <option value="tool_use">Tool Use</option>
          </select>
        </label>
      </div>

      <h3 style={sectionHeading}>Target Model</h3>
      <div style={fieldGroup}>
        <label style={labelStyle}>
          Model
          <input
            style={inputStyle}
            required
            value={values.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="openai/gpt-4o-mini"
          />
        </label>

        <label style={labelStyle}>
          Temperature
          <input
            style={inputStyle}
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={values.temperature}
            onChange={(e) => set('temperature', e.target.value)}
          />
        </label>
      </div>

      <label style={labelStyle}>
        System Prompt
        <textarea
          style={{ ...inputStyle, minHeight: 80 }}
          value={values.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
          placeholder="You are a helpful assistant."
        />
      </label>

      <label style={labelStyle}>
        User Prompt Template
        <textarea
          style={{ ...inputStyle, minHeight: 60, fontFamily: 'monospace', fontSize: 13 }}
          value={values.userPromptTemplate}
          onChange={(e) => set('userPromptTemplate', e.target.value)}
          placeholder="{{input}}"
        />
        <span style={{ color: '#6b7280', fontSize: 12 }}>
          Use {'{{varName}}'} to reference dataset variables.
        </span>
      </label>

      {values.type === 'tool_use' && (
        <ToolSchemaEditor
          tools={values.tools}
          onChange={(tools) => set('tools', tools)}
        />
      )}

      <h3 style={sectionHeading}>Run Config</h3>
      <label style={labelStyle}>
        Repeats per Case
        <input
          style={{ ...inputStyle, maxWidth: 120 }}
          type="number"
          min={1}
          max={20}
          value={values.nRepeats}
          onChange={(e) => set('nRepeats', e.target.value)}
        />
      </label>

      <h3 style={sectionHeading}>Judge</h3>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={values.judgeEnabled}
          onChange={(e) => set('judgeEnabled', e.target.checked)}
        />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Enable judge scoring</span>
      </label>

      {values.judgeEnabled && (
        <div style={fieldGroup}>
          <label style={labelStyle}>
            Judge Model
            <input
              style={inputStyle}
              value={values.judgeModel}
              onChange={(e) => set('judgeModel', e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Rubric
            <textarea
              style={{ ...inputStyle, minHeight: 80 }}
              value={values.judgeRubric}
              onChange={(e) => set('judgeRubric', e.target.value)}
              placeholder="Describe what a good response looks like. Score 1–5."
            />
          </label>
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : initial ? 'Update Suite' : 'Create Suite'}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const sectionHeading: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#1f2937',
  marginTop: 20,
  marginBottom: 8,
  borderBottom: '1px solid #e5e7eb',
  paddingBottom: 4,
};

const fieldGroup: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};
