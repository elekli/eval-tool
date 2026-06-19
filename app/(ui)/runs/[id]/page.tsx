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
  // Cache of results and cases fetched during initialize/refresh — used by loadResults
  const resultsCache = useRef<Result[]>([]);
  const casesCache = useRef<TestCase[]>([]);

  useEffect(() => {
    let cancelled = false;

    void initialize(cancelled, (v) => { if (!cancelled) setRun(v); }, (v) => { if (!cancelled) setSummary(v); }, (v) => { if (!cancelled) setLoading(v); }, (v) => { if (!cancelled) setError(v); });

    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [id]);

  async function initialize(
    cancelled: boolean,
    _setRun: (r: Run) => void,
    _setSummary: (s: Summary) => void,
    _setLoading: (v: boolean) => void,
    _setError: (e: string) => void,
  ) {
    _setLoading(true);
    try {
      const [runRes, summaryRes] = await Promise.all([
        fetch(`/api/runs/${id}`),
        fetch(`/api/runs/${id}/summary`),
      ]);
      if (!runRes.ok) throw new Error('Run not found');
      if (!summaryRes.ok) throw new Error(`Summary fetch failed: HTTP ${summaryRes.status}`);

      const { run: r, results, cases } = (await runRes.json()) as { run: Run; results: Result[]; cases: TestCase[] };
      const s = (await summaryRes.json()) as Summary;

      // Cache for loadResults usage — no second network fetch needed
      resultsCache.current = results;
      casesCache.current = cases;

      if (!cancelled) {
        _setRun(r);
        _setSummary(s);
      }

      // If still running, subscribe to SSE events
      if ((r.status === 'running' || r.status === 'queued') && !cancelled) {
        subscribeSSE();
      }
    } catch (err) {
      if (!cancelled) _setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!cancelled) _setLoading(false);
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
      const { run: r, results, cases } = (await runRes.json()) as { run: Run; results: Result[]; cases: TestCase[] };
      const s = (await summaryRes.json()) as Summary;

      // Update caches
      resultsCache.current = results;
      casesCache.current = cases;

      setRun(r);
      setSummary(s);
    } catch {
      // Silently ignore refresh errors
    }
  }

  function loadResults(testCaseId: string): Promise<{ testCase: TestCase; results: Result[] }> {
    const caseResults = resultsCache.current.filter((r) => r.testCaseId === testCaseId);
    const testCase = casesCache.current.find((c) => c.id === testCaseId) ?? {
      id: testCaseId,
      datasetId: '',
      vars: {},
    };
    return Promise.resolve({ testCase, results: caseResults });
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
