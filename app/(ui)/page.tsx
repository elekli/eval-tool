import Link from 'next/link';
import type { Suite } from '@core/types';
import { getContainer, LOCAL_OWNER } from '@app/lib/container';

export default async function HomePage() {
  let suites: Suite[];
  try {
    suites = getContainer().repo.listSuites(LOCAL_OWNER);
  } catch {
    suites = [];
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1f2937' }}>Eval Tool</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Local LLM evaluation harness
          </p>
        </div>
        <Link
          href="/suites/new"
          style={{
            background: '#2563eb',
            color: '#fff',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + New Suite
        </Link>
      </div>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          Suites
        </h2>

        {suites.length === 0 ? (
          <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, padding: '32px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>No suites yet.</p>
            <Link href="/suites/new" style={{ color: '#2563eb', fontSize: 13, fontWeight: 500 }}>
              Create your first suite →
            </Link>
          </div>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {suites.map((suite, idx) => (
              <Link
                key={suite.id}
                href={`/suites/${suite.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 16px',
                  textDecoration: 'none',
                  borderBottom: idx < suites.length - 1 ? '1px solid #e5e7eb' : 'none',
                  background: 'transparent',
                  color: 'inherit',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{suite.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {suite.type === 'tool_use' ? 'Tool Use' : 'Behavior'} · {suite.target.model} · {suite.runConfig.nRepeats}× repeats
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {new Date(suite.createdAt).toLocaleDateString()}
                </div>
                <span style={{ marginLeft: 12, color: '#2563eb', fontSize: 13 }}>→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
