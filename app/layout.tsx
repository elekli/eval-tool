import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Eval Tool',
  description: 'Local LLM evaluation tool',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #111827;
            background: #f9fafb;
          }
          a { color: inherit; }
          button, input, select, textarea { font-family: inherit; }
          @media (max-width: 640px) {
            main { padding-left: 12px !important; padding-right: 12px !important; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
