import React from 'react';

export default function DocumentationPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>Product Documentation</h1>
      <p style={{ fontSize: 14, color: '#475569', marginBottom: 32 }}>
        Architecture, governance boundaries, and security model for LIMEN Vault.
      </p>

      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px 0' }}>Local-First Fallback Architecture</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
            LIMEN Vault operates directly on local Markdown files stored on your Mac. It requires zero cloud connectivity or external server APIs to open, browse, search, or verify local snapshots.
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px 0' }}>Write Safety & AI Permissions</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
            Raw source materials (`20_RAW_SOURCES`) and Approved Knowledge (`01_CLIENTS` - `10_APPROVED_OUTPUTS`) are strictly read-only for AI processes. AI outputs can only be written to `80_AI_OUTPUTS` or `90_PROPOSALS`.
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px 0' }}>Prohibited Providers & Ecosystem</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
            Authorized AI inference ecosystem: OpenAI, ChatGPT, Codex, and local LLM models. Non-approved third-party AI APIs and external LLM providers are strictly prohibited by system governance.
          </p>
        </div>
      </div>
    </div>
  );
}
