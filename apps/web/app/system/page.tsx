import React from 'react';

export default function WebSystemPage() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px 0' }}>Web Console Status</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
          Environment diagnostics for Vercel deployment target: <code>limen-vault</code>
        </p>
      </div>

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>Vercel Target Project</td>
              <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: 600 }}>limen-vault</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>Architecture Mode</td>
              <td style={{ padding: '12px 0', color: '#0f172a', fontWeight: 600 }}>Web Presentation Layer (Complementary)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>Local Mac Filesystem Access</td>
              <td style={{ padding: '12px 0', color: '#94a3b8', fontWeight: 500 }}>
                Not Available (Web browser security sandbox — use Desktop Tauri App)
              </td>
            </tr>
            <tr>
              <td style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>External CRM / MEMAI Status</td>
              <td style={{ padding: '12px 0', color: '#64748b', fontWeight: 600 }}>NOT CONFIGURED (Standalone Mode)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
