import React from 'react';

export default function DesktopAppDownloadPage() {
  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>LIMEN Vault for macOS</h1>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 28 }}>
        The native macOS application provides full local filesystem access, offline markdown search, Obsidian vault integration, and snapshot integrity verification.
      </p>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0' }}>Milestone 1 — Desktop UI Shell Build</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          The native macOS desktop shell (`apps/desktop`) is available locally in this monorepo. Production installer builds (`.dmg` / `.app`) will be packaged during Milestone 9 release.
        </p>

        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12 }}>
          pnpm dev:desktop
        </div>
      </div>
    </div>
  );
}
