'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Suite, Dataset } from '@core/types';
import { SuiteForm } from '@app/components/SuiteForm';
import { DatasetGenerator } from '@app/components/DatasetGenerator';

export default function SuitePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [suite, setSuite] = useState<Suite | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [launching, setLaunching] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    void loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [suiteRes, datasetsRes] = await Promise.all([
        fetch(`/api/suites/${id}`),
        fetch('/api/datasets'),
      ]);
      if (!suiteRes.ok) throw new Error('Suite not found');
      const s = (await suiteRes.json()) as Suite;
      const ds = (await datasetsRes.json()) as Dataset[];
      setSuite(s);
      setDatasets(ds);
      if (ds.length > 0 && ds[0]) setSelectedDatasetId(ds[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    if (!selectedDatasetId) return;
    setLaunching(true);
    setRunError(null);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId: id, datasetId: selectedDatasetId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { id: runId } = (await res.json()) as { id: string };
      router.push(`/runs/${runId}`);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunching(false);
    }
  }

  function handleDatasetSaved(ds: Dataset) {
    setDatasets((prev) => [...prev, ds]);
    setSelectedDatasetId(ds.id);
    setShowGenerator(false);
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px', color: '#9ca3af', fontSize: 14 }}>
        Loading…
      </main>
    );
  }

  if (error || !suite) {
    return (
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{error ?? 'Suite not found'}</div>
        <Link href="/" style={{ color: '#2563eb', fontSize: 13 }}>← Back</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
      <nav style={{ marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Suites</Link>
        <span> / {suite.name}</span>
      </nav>

      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>{suite.name}</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af' }}>
        {suite.type === 'tool_use' ? 'Tool Use' : 'Behavior'} · {suite.target.model} · {suite.runConfig.nRepeats}× repeats
      </p>

      {/* Run trigger */}
      <section style={card}>
        <h2 style={sectionH}>Launch Run</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 10px', fontSize: 13, flex: 1, minWidth: 200 }}
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
          >
            {datasets.length === 0 && <option value="">No datasets — create one below</option>}
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={launching || !selectedDatasetId}
            onClick={() => void handleRun()}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: launching || !selectedDatasetId ? 'not-allowed' : 'pointer',
              opacity: launching || !selectedDatasetId ? 0.6 : 1,
            }}
          >
            {launching ? 'Launching…' : 'Run'}
          </button>
        </div>
        {runError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
            {runError}
          </div>
        )}
      </section>

      {/* Dataset section */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ ...sectionH, marginBottom: 0 }}>Datasets</h2>
          <button
            type="button"
            onClick={() => setShowGenerator((v) => !v)}
            style={{ color: '#2563eb', background: 'none', border: '1px solid #93c5fd', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            {showGenerator ? 'Cancel' : '+ Generate Dataset'}
          </button>
        </div>

        {showGenerator && (
          <div style={{ marginBottom: 16, background: '#f9fafb', borderRadius: 6, padding: 16 }}>
            <DatasetGenerator onSaved={handleDatasetSaved} />
          </div>
        )}

        {datasets.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
            No datasets yet.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {datasets.map((ds) => (
              <li
                key={ds.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 500, color: '#1f2937', flex: 1 }}>{ds.name}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{ds.source}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suite editor */}
      <section style={card}>
        <h2 style={sectionH}>Edit Suite</h2>
        <SuiteForm
          initial={suite}
          onSaved={(updated) => setSuite(updated)}
        />
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '16px 20px',
  marginBottom: 20,
};

const sectionH: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1f2937',
  margin: '0 0 12px',
};
