'use client';

import { useRouter } from 'next/navigation';
import type { Suite } from '@core/types';
import { SuiteForm } from '@app/components/SuiteForm';

export default function NewSuitePage() {
  const router = useRouter();

  function handleSaved(suite: Suite) {
    router.push(`/suites/${suite.id}`);
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
      <nav style={{ marginBottom: 20, fontSize: 13, color: '#6b7280' }}>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Suites</a>
        <span> / New</span>
      </nav>
      <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
        New Suite
      </h1>
      <SuiteForm onSaved={handleSaved} />
    </main>
  );
}
