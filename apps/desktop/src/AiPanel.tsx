import React, { useEffect, useRef, useState } from 'react';
import { aiIpc, type AiAnswer, type AiPreview, type AiSource } from './ai-ipc';
import type { CitationOpenRequest } from './vault-ipc';
import { labelIt, MessageIt } from './locale';
import { SemanticEngineSettings } from './SemanticEngineSettings';
import { TunnelPanel } from './TunnelPanel';
import { getPlatformTerms } from './platform';
import { m7, operationId } from './proposal-ipc';
import { ChevronDown, ChevronRight, ShieldAlert, Sparkles, FileText, Check, AlertCircle, Key, Lock } from 'lucide-react';

const fieldStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  font: 'inherit',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: 8,
  font: 'inherit',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  background: '#0f172a',
  color: 'white',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'background 0.2s',
};

// Clean titles: remove technical prefixes (e.g. doc_..._) and .md extension
function cleanTitle(title: string, relativePath: string): string {
  if (title && !title.startsWith('doc_') && !title.endsWith('.md')) {
    return title;
  }
  const base = relativePath.split('/').pop() || relativePath;
  return base.replace(/\.md$/i, '').replace(/^[a-f0-9_-]{8,16}_/i, '');
}

export function AiPanel({
  vaultPath,
  onOpenDocument,
}: {
  vaultPath: string;
  onOpenDocument?: (req: CitationOpenRequest) => void;
}) {
  const terms = getPlatformTerms();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [drafts, setDrafts] = useState(false);
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [previewData, setPreviewData] = useState<AiPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [techError, setTechError] = useState<string | null>(null);

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  const [saveMessage, setSaveMessage] = useState('');
  const saveOperation = useRef(operationId());
  const seq = useRef(0);

  // Check consent status on mount or vaultPath change
  useEffect(() => {
    let live = true;
    aiIpc.getConsent(vaultPath)
      .then(g => { if (live) setConsentGranted(g); })
      .catch(() => { if (live) setConsentGranted(false); });
    return () => { live = false; };
  }, [vaultPath]);

  async function handleGrantConsentInline() {
    try {
      await aiIpc.setConsent(vaultPath, true);
      setConsentGranted(true);
      setError(null);
      // Automatically trigger answer request if prompt is not empty
      if (prompt.trim()) {
        void executeAsk(prompt.trim());
      }
    } catch (e) {
      setError('Impossibile aggiornare il consenso.');
      setTechError(String(e));
    }
  }

  async function executeAsk(queryText: string) {
    if (!queryText || loadingStep) return;

    const currentSeq = ++seq.current;
    setError(null);
    setTechError(null);
    setAnswer(null);
    setPreviewData(null);
    setSaveMessage('');

    // Check consent before running
    const hasConsent = await aiIpc.getConsent(vaultPath).catch(() => false);
    setConsentGranted(hasConsent);

    if (!hasConsent) {
      return; // Inline consent banner will be shown
    }

    setLoadingStep('Selezione passaggi pertinenti dal Vault…');

    const t0 = Date.now();

    try {
      // Step 1: Preview / Select sources automatically
      const preview = await aiIpc.preview(vaultPath, {
        prompt: queryText,
        model: model || 'gpt-4o',
        includeDrafts: drafts,
        sourceIds: [],
      });

      if (currentSeq !== seq.current) return;
      setPreviewData(preview);

      if (preview.sources.length === 0) {
        setLoadingStep(null);
        setError('Nessun passaggio pertinente trovato nel Vault per questa domanda.');
        return;
      }

      // Step 2: Query Model directly
      setLoadingStep('Generazione della risposta con OpenAI…');
      const uiPreviewElapsed = Math.round(Date.now() - t0);
      const res = await aiIpc.ask(preview.ticket, uiPreviewElapsed);

      if (currentSeq !== seq.current) return;
      res.uiTotalMs = Math.round(Date.now() - t0);
      setAnswer(res);
      saveOperation.current = operationId();
    } catch (e: any) {
      if (currentSeq !== seq.current) return;
      const errStr = String(e?.message || e);
      if (errStr.includes('Consenso')) {
        setConsentGranted(false);
      } else {
        setError('Impossibile completare la risposta. Verifica la connessione o la chiave API.');
        setTechError(errStr);
      }
    } finally {
      if (currentSeq === seq.current) {
        setLoadingStep(null);
      }
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search / Question Header */}
      <div className="limen-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Sparkles size={20} color="#0f172a" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>
            Chiedi al Vault
          </h2>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          Fai una domanda per ottenere una risposta in prosa sintetizzata direttamente dai tuoi documenti.
        </p>

        {/* Question Input Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <textarea
              aria-label="Domanda al Vault"
              placeholder="Es. Cosa è il progetto BNXT e quali requisiti prevede?"
              maxLength={2000}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (prompt.trim()) executeAsk(prompt.trim());
                }
              }}
              style={{
                ...fieldStyle,
                minHeight: 90,
                resize: 'vertical',
                paddingRight: 100,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            />
            <button
              style={{
                ...primaryButtonStyle,
                position: 'absolute',
                right: 10,
                bottom: 14,
                padding: '8px 16px',
              }}
              disabled={!!loadingStep || !prompt.trim()}
              onClick={() => prompt.trim() && executeAsk(prompt.trim())}
            >
              Chiedi
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={drafts}
                onChange={e => setDrafts(e.target.checked)}
              />
              Includi bozze e note non approvate
            </label>
            <span>Premere Invio per inviare</span>
          </div>
        </div>
      </div>

      {/* Consent Warning Banner Inline if missing */}
      {consentGranted === false && (
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ShieldAlert size={22} color="#d48806" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: '#d48806' }}>
                Consenso all’invio dei dati richiesto
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: '#595959', lineHeight: 1.4 }}>
                Per generare la risposta, i soli passaggi dei documenti pertinenti alla domanda verranno inviati in modo sicuro a OpenAI. Nessun documento viene salvato o usato per l'addestramento.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleGrantConsentInline}
              style={{
                ...primaryButtonStyle,
                backgroundColor: '#d48806',
                color: '#fff',
                fontSize: 13,
                padding: '8px 16px',
              }}
            >
              <Check size={16} />
              Consenti l’invio a OpenAI e genera risposta
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingStep && (
        <div className="limen-card" style={{ padding: 24, textAlign: 'center', color: '#475569' }}>
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }}>
            <Sparkles size={24} color="#0f172a" />
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{loadingStep}</p>
        </div>
      )}

      {/* Error Message */}
      {error && !loadingStep && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 4 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          {techError && (
            <details style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Dettaglio tecnico errore</summary>
              <pre style={{ margin: '6px 0 0 0', padding: 8, background: '#fee2e2', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                {techError}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Prose Answer Result Block */}
      {answer && !loadingStep && (
        <div className="limen-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Answer Foreground Prose */}
          <div style={{ fontSize: 15, lineHeight: 1.7, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
            {answer.answer}
          </div>

          {/* Collapsible Sources Line: "Basata su N documenti" */}
          {answer.citations && answer.citations.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#2563eb',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {sourcesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Basata su {answer.citations.length} document{answer.citations.length === 1 ? 'o' : 'i'}
              </button>

              {sourcesOpen && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {answer.citations.map((c, i) => {
                    const clean = cleanTitle(c.title, c.relativePath);
                    return (
                      <div
                        key={`${c.documentId}-${i}`}
                        onClick={() => {
                          if (onOpenDocument) {
                            onOpenDocument({
                              documentId: c.documentId,
                              passageId: c.passageId,
                              locator: c.locator,
                              revision: c.revision,
                              sha256: c.sha256,
                            });
                          }
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 6,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={16} color="#64748b" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                            {clean}
                          </span>
                          {c.category && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: '#e2e8f0',
                                color: '#475569',
                              }}
                            >
                              {c.category}
                            </span>
                          )}
                        </div>
                        {c.locator && (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {c.locator}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Save as Draft & Technical Details Accordion */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <button
              style={{
                ...primaryButtonStyle,
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                fontSize: 13,
                padding: '6px 14px',
              }}
              disabled={!!saveMessage}
              onClick={async () => {
                try {
                  await m7(vaultPath, {
                    action: 'save',
                    operationId: saveOperation.current,
                    title: prompt.slice(0, 200),
                    content: answer.answer,
                    provider: answer.provider,
                    model: answer.model,
                    sources: answer.citations,
                  });
                  setSaveMessage('Bozza salvata in locale.');
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              {saveMessage || 'Salva risposta come bozza'}
            </button>

            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
              Risposta generata con OpenAI ({answer.model})
            </span>
          </div>

          {/* Dettagli Tecnici Accordion */}
          <div style={{ marginTop: 4 }}>
            <details
              open={techDetailsOpen}
              onToggle={e => setTechDetailsOpen((e.target as HTMLDetailsElement).open)}
              style={{ fontSize: 12, color: '#64748b' }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#64748b' }}>
                Dettagli tecnici
              </summary>
              <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>Fornitore:</strong> {answer.provider}</div>
                <div><strong>Modello:</strong> {answer.model}</div>
                <div><strong>Token usati:</strong> {answer.tokensUsed ?? 'N/A'}</div>
                {answer.uiTotalMs && <div><strong>Tempo interfaccia (totale):</strong> {(answer.uiTotalMs / 1000).toFixed(1)} s ({answer.uiTotalMs} ms)</div>}
                {previewData && <div><strong>Dimensione contesto:</strong> {previewData.contextBytes} byte</div>}
                <div><strong>Citazioni grezze:</strong></div>
                {answer.citations.map((c, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
                    • {c.documentId} | SHA256: {c.sha256} | Path: {c.relativePath}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiSettings({ vaultPath }: { vaultPath: string }) {
  const terms = getPlatformTerms();
  const [key, setKey] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [consent, setConsent] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [availableModels, setAvailableModels] = useState<string[]>(['gpt-4o', 'gpt-4o-mini', 'gpt-6-sol']);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<{ active: boolean; endpoint?: string; vaultId?: string; token?: string }>({ active: false });

  useEffect(() => {
    void aiIpc.mcpStatus().then(setConnection).catch(e => setMessage(String(e)));
    void aiIpc.getConsent(vaultPath).then(setConsent).catch(() => {});
    void aiIpc.models().then(m => { if (m && m.length > 0) setAvailableModels(m); }).catch(() => {});
  }, [vaultPath]);

  async function action(f: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await f();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleConsent(granted: boolean) {
    setConsent(granted);
    try {
      await aiIpc.setConsent(vaultPath, granted);
      setMessage(granted ? 'Consenso a OpenAI attivato.' : 'Consenso a OpenAI disattivato.');
    } catch (e) {
      setMessage(String(e));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SemanticEngineSettings vaultPath={vaultPath} />

      {/* OpenAI & Consent Settings Box */}
      <div className="limen-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Key size={18} color="#0f172a" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Impostazioni OpenAI & Consenso</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Consent Toggle (Item 2 Requirement) */}
          <div style={{ padding: 16, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => handleToggleConsent(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>
                  Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte
                </strong>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                  Quando attivo, le domande inviate nella scheda Chiedi genereranno la risposta tramite le API di OpenAI inviando solo i passaggi estratti dal Vault.
                </p>
              </div>
            </label>
          </div>

          {/* Model Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Modello OpenAI predefinito
            </label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              style={fieldStyle}
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* API Key Management */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Chiave API OpenAI (memorizzata nel {terms.keychainTerm})
            </label>
            <input
              type="password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              aria-label="Chiave API OpenAI"
              value={key}
              onChange={e => setKey(e.target.value)}
              style={fieldStyle}
              placeholder="sk-proj-..."
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                style={primaryButtonStyle}
                disabled={busy || !key}
                onClick={() => {
                  const val = key;
                  setKey('');
                  void action(async () => {
                    await aiIpc.saveKey(val);
                    setConfigured(true);
                    setMessage(`Chiave salvata nel ${terms.keychainTerm}.`);
                  });
                }}
              >
                Salva chiave
              </button>
              <button
                style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', background: '#f1f5f9' }}
                disabled={busy}
                onClick={() => action(async () => setConfigured(await aiIpc.status()))}
              >
                Verifica {terms.keychainTerm}
              </button>
              <button
                style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' }}
                disabled={busy}
                onClick={() => action(async () => { await aiIpc.deleteKey(); setConfigured(false); })}
              >
                Rimuovi chiave
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              {configured === null
                ? `${terms.keychainTerm} non verificato`
                : configured
                ? '✓ Chiave API configurata ed esaminata'
                : 'Nessuna chiave API configurata'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Connections / MCP Box */}
      <div className="limen-card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600 }}>Collegamenti AI & Tunnel</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px 0', lineHeight: 1.4 }}>
          Condivisione in sola lettura per client esterni ed MCP. {terms.isWin ? 'Il computer e questa app devono restare accesi' : 'Il Mac e questa app devono restare accesi'}.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            style={primaryButtonStyle}
            disabled={busy || connection.active}
            onClick={() => action(async () => {
              const c = await aiIpc.mcpStart(vaultPath, false);
              setConnection({ ...c, active: true });
            })}
          >
            Attiva MCP locale
          </button>
          <button
            style={{ ...fieldStyle, width: 'auto', cursor: 'pointer', background: '#f1f5f9' }}
            disabled={busy || !connection.active}
            onClick={() => action(async () => { await aiIpc.mcpStop(); setConnection({ active: false }); })}
          >
            Revoca MCP
          </button>
        </div>
        {connection.active && (
          <div style={{ fontSize: 13, color: '#334155', display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: '#f8fafc', padding: 12, borderRadius: 6 }}>
            <div><strong>Indirizzo attivo:</strong> {connection.endpoint}</div>
            <div><strong>ID Vault:</strong> {connection.vaultId}</div>
            {connection.token && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer' }}>Mostra token di collegamento</summary>
                <input aria-label="Token MCP" type="password" readOnly value={connection.token} style={{ ...fieldStyle, marginTop: 4 }} />
              </details>
            )}
          </div>
        )}
        {message && <p role="status" style={{ fontSize: 13, color: '#2563eb', marginTop: 10 }}>{<MessageIt value={message} />}</p>}
        <TunnelPanel vaultPath={vaultPath} />
      </div>
    </div>
  );
}
