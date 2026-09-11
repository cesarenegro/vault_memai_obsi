import React from 'react';
import '@limen-vault/ui/dist/styles.css';

export const metadata = {
  title: 'LIMEN Vault — Independent AI Knowledge System',
  description: 'Local-first independent AI knowledge environment for LIMEN / Packaging in Italy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f8fafc', color: '#0f172a' }}>
        <nav
          style={{
            height: 60,
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/" style={{ textDecoration: 'none', color: '#0f172a', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>
              LIMEN VAULT
            </a>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
              WEB CONSOLE
            </span>
          </div>

          <div style={{ display: 'flex', gap: 24, fontSize: 13, fontWeight: 500 }}>
            <a href="/" style={{ color: '#0f172a', textDecoration: 'none' }}>AI Knowledge</a>
            <a href="/system" style={{ color: '#475569', textDecoration: 'none' }}>System</a>
            <a href="/desktop-app" style={{ color: '#475569', textDecoration: 'none' }}>Desktop App</a>
            <a href="/documentation" style={{ color: '#475569', textDecoration: 'none' }}>Documentation</a>
          </div>
        </nav>

        <main style={{ maxWidth: 1120, margin: '40px auto', padding: '0 24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
