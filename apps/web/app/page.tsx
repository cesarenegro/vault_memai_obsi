import React from 'react';

export default function AIKnowledgePage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          AI Knowledge Environment
        </h1>
        <p style={{ fontSize: 14, color: '#475569', margin: 0, maxWidth: 640 }}>
          Overview of connected AI knowledge platforms and independent local vault architecture.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
        {/* MEMAI CARD */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 28,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                PRIMARY AI KNOWLEDGE
              </span>
              <span
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                NOT CONFIGURED
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
              External CRM System
            </h2>

            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Central cloud intelligence system for Packaging in Italy. Currently not linked to this standalone environment. No runtime dependency or live telemetry configured.
            </p>
          </div>

          <div>
            <button
              disabled
              style={{
                width: '100%',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              OPEN MEMAI (Not Configured)
            </button>
          </div>
        </div>

        {/* LIMEN VAULT CARD */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            padding: 28,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#0f172a', textTransform: 'uppercase' }}>
                INDEPENDENT KNOWLEDGE SYSTEM
              </span>
              <span
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                LOCAL-FIRST ARCHITECTURE
              </span>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
              LIMEN Vault macOS
            </h2>

            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Local-first knowledge environment designed to remain 100% functional on your Mac even when external servers, cloud APIs, and MEMAI are completely offline.
            </p>
          </div>

          <div>
            <a
              href="/desktop-app"
              style={{
                display: 'block',
                textAlign: 'center',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              GET LIMEN VAULT DESKTOP
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
