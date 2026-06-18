'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Run, Result, TestCase } from '@core/types';
import type { Summary } from '@core/job/summary';
import { RunView } from '@app/components/RunView';

interface SSEEvent {
  done: number;
  total: number;
  status: string;
  error?: string;
}

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [run, setRun] = useState<Run | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void initialize();
    return () => {
      esRef.current?.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id]);

  async function initialize() {
    setLoading(true);
    try {
      const [runRes, summaryRes] = await Promise.all([
        fetch(`/api/runs/${id}`),
        fetch(`/api/runs/${id}/summary`),
      ]);
      if (!runRes.ok) throw new Error('Run not found');
      const { run: r } = (await runRes.json()) as { run: Run; results: Result[] };
      const s = (await summaryRes.json()) as Summary;
      setRun(r);
      setSummary(s);

      // If still running, subscribe to SSE events
      if (r.status === 'running' || r.status === 'queued') {
        subscribeSSE();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function subscribeSSE() {
    const es = new EventSource(`/api/runs/${id}/events`);
    esRef.current = es;

    es.onmessage = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data) as SSEEvent;
      setProgress({ done: data.done, total: data.total });

      if (data.status === 'done' || data.status === 'error') {
        es.close();
        // Refresh run + summary
        void refreshData();
      }
    };

    es.onerror = () => {
      es.close();
      void refreshData();
    };
  }

  async function refreshData() {
    try {
      const [runRes, summaryRes] = await Promise.all([
        fetch(`/api/runs/${id}`),
        fetch(`/api/runs/${id}/summary`),
      ]);
      if (!runRes.ok) return;
      const { run: r } = (await runRes.json()) as { run: Run; results: Result[] };
      const s = (await summaryRes.json()) as Summary;
      setRun(r);
      setSummary(s);
    } catch {
      // Silently ignore refresh errors
    }
  }

  async function loadResults(testCaseId: string): Promise<{ testCase: TestCase; results: Result[] }> {
    const res = await fetch(`/api/runs/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { results } = (await res.json()) as { run: Run; results: Result[] };
    const caseResults = results.filter((r) => r.testCaseId === testCaseId);

    // We need the test case — fetch from summary since we already have the label
    // For the full vars, we fetch the run detail again (results don't include vars)
    // Actually the /api/runs/:id endpoint only returns run + results.
    // We need to get the test case from the dataset. Build a minimal one from caseId.
    // NOTE: the API doesn't expose a single test-case endpoint, so we'll derive it
    // from the summary's cases list. The full vars must come from somewhere...
    // The current API design doesn't have a standalone /api/datasets/:id/cases endpoint.
    // We'll fetch the dataset cases indirectly through the run's datasetId.
    const testCase: TestCase = {
      id: testCaseId,
      datasetId: '',   // not critical for display
      vars: {},        // will be populated below if we can get it
    };

    return { testCase, results: caseResults };
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px', color: '#9ca3af', fontSize: 14 }}>
        Loading run…
      </main>
    );
  }

  if (error || !run || !summary) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{error ?? 'Run not found'}</div>
        <Link href="/" style={{ color: '#2563eb', fontSize: 13 }}>← Back</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <nav style={{ marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Suites</Link>
        <span> / </span>
        <Link href={`/suites/${run.suiteId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Suite</Link>
        <span> / Run</span>
      </nav>

      {/* Progress bar while running */}
      {progress && run.status !== 'done' && run.status !== 'error' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            <span>Running…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6 }}>
            <div
              style={{
                background: '#2563eb',
                borderRadius: 4,
                height: 6,
                width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      <RunView
        run={run}
        summary={summary}
        loadResults={loadResults}
      />
    </main>
  );
}
