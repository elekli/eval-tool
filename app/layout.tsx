import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eval Tool',
  description: 'Local LLM evaluation tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
