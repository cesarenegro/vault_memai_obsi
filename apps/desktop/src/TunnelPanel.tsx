import { labelIt, MessageIt } from './locale';
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function TunnelPanel({ vaultPath }: { vaultPath: string }) {
  const [tunnelId, setTunnel] = useState('');
  const [organizationId, setOrg] = useState('');
  const [key, setKey] = useState('');
  const [state, setState] = useState<{ active: boolean; ready: boolean; error?: string }>({ active: false, ready: false });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const isWin = typeof navigator !== 'undefined' && navigator.platform ? navigator.platform.toLowerCase().includes('win') : true;

  async function check() {
    setState(await invoke('tunnel_status'));
  }

  useEffect(() => {
    let live = true;
    void invoke<{ tunnelId: string; organizationId: string } | null>('tunnel_config')
      .then((c) => {
        if (live && c) {
          setTunnel(c.tunnelId);
          setOrg(c.organizationId);
        }
      })
      .catch((e) => {
        if (live) setMessage(String(e));
      });
    const timer = setInterval(() => {
      void check().catch(() => {});
    }, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      await check();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    marginTop: 4,
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <section className="limen-card" style={{ marginTop: 24, padding: 24, borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
        ChatGPT Business · tunnel privato
      </h4>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
        Collegamento facoltativo per condividere fonti approvate e indicizzate del Vault selezionato. {isWin ? 'Questo computer' : 'Il Mac'} e questa app devono restare accesi. Occorre una configurazione corrispondente di tunnel, spazio di lavoro e organizzazione nell’account OpenAI.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 500, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block' }}>
            ID tunnel
          </label>
          <input
            style={inputStyle}
            aria-label="ID tunnel Business"
            value={tunnelId}
            onChange={(e) => setTunnel(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="es. tunnel_abc123"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block' }}>
            ID organizzazione
          </label>
          <input
            style={inputStyle}
            aria-label="ID organizzazione Business"
            value={organizationId}
            onChange={(e) => setOrg(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="es. org_12345"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block' }}>
            Chiave di esecuzione del tunnel
          </label>
          <input
            type="password"
            style={inputStyle}
            autoComplete="off"
            aria-label="Chiave di esecuzione del tunnel"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="●●●●●●●●●●●●"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          style={btnStyle}
          disabled={busy || !key}
          onClick={() => {
            const value = key;
            setKey('');
            void action(() => invoke('tunnel_save_key', { key: value }));
          }}
        >
          SALVA CHIAVE TUNNEL
        </button>
        <button
          style={{ ...btnStyle, backgroundColor: state.active ? '#e2e8f0' : '#0f172a', color: state.active ? '#64748b' : '#ffffff', border: 'none' }}
          disabled={busy || state.active || !tunnelId || !organizationId}
          onClick={() => action(() => invoke('tunnel_start', { config: { tunnelId: tunnelId.trim(), organizationId: organizationId.trim(), vaultPath } }))}
        >
          AVVIA TUNNEL BUSINESS
        </button>
        <button
          style={{ ...btnStyle, color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          disabled={busy || !state.active}
          onClick={() => action(() => invoke('tunnel_stop'))}
        >
          ARRESTA TUNNEL BUSINESS
        </button>
      </div>

      <p role="status" style={{ fontSize: 13, color: state.active ? '#15803d' : '#64748b', fontWeight: 500, margin: '8px 0' }}>
        {state.active ? (state.ready ? '● Tunnel locale pronto — verifica il collegamento in ChatGPT Business' : '● Avvio del tunnel in corso…') : '○ Tunnel arrestato'}
        {state.error && <MessageIt value={state.error} />}
      </p>
      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
        L’arresto impedisce nuove letture locali. Scollega anche il plugin in ChatGPT per revocare il collegamento remoto. Il tunnel non si avvia automaticamente all’accesso.
      </p>
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>
          <MessageIt value={message} />
        </p>
      )}
    </section>
  );
}
