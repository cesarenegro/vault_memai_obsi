import React, { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { aiIpc, type AiAnswer, type AiPreview, type AiSource, type AiStreamChunkPayload, type AiStreamEndPayload } from './ai-ipc';
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
  const [model, setModel] = useState<string>('gpt-4o');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(false);
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [previewData, setPreviewData] = useState<AiPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [techError, setTechError] = useState<string | null>(null);

  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  const [saveMessage, setSaveMessage] = useState('');
  const saveOperation = useRef(operationId());
  const seq = useRef(0);
  const unlistenChunkRef = useRef<UnlistenFn | null>(null);
  const unlistenEndRef = useRef<UnlistenFn | null>(null);

  // Carica i modelli disponibili e il modello selezionato memorizzato (default: gpt-4o)
  useEffect(() => {
    let live = true;
    void aiIpc.models().then(list => {
      if (!live) return;
      if (list && list.length > 0) {
        setAvailableModels(list);
      }
    }).catch(() => {});

    void aiIpc.getSelectedModel().then(saved => {
      if (!live) return;
      if (saved) {
        setModel(saved);
      } else {
        setModel('gpt-4o');
      }
    }).catch(() => {
      if (live) setModel('gpt-4o');
    });

    return () => {
      live = false;
      if (unlistenChunkRef.current) unlistenChunkRef.current();
      if (unlistenEndRef.current) unlistenEndRef.current();
    };
  }, []);

  async function handleModelChange(newModel: string) {
    setModel(newModel);
    try {
      await aiIpc.saveSelectedModel(newModel);
    } catch (e) {
      console.error('Impossibile salvare il modello selezionato:', e);
    }
  }

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
    if (!queryText || loadingStep || isStreaming) return;
    const currentModel = model || 'gpt-4o';

    const currentSeq = ++seq.current;
    setError(null);
    setTechError(null);
    setAnswer(null);
    setPreviewData(null);
    setStreamingText('');
    setIsStreaming(false);
    setSaveMessage('');

    if (unlistenChunkRef.current) {
      unlistenChunkRef.current();
      unlistenChunkRef.current = null;
    }
    if (unlistenEndRef.current) {
      unlistenEndRef.current();
      unlistenEndRef.current = null;
    }

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
        model: currentModel,
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

      // Fonti consultate mostrate SUBITO non appena la preview è pronta!
      setSourcesOpen(true);
      setLoadingStep('Avvio generazione in streaming con OpenAI…');
      setIsStreaming(true);

      // Step 2: Registra i listener Tauri per gli eventi di streaming
      try {
        const uChunk = await listen<AiStreamChunkPayload>('limen://ai-stream-chunk', (event) => {
          if (currentSeq !== seq.current) return;
          if (event.payload.ticket === preview.ticket) {
            setLoadingStep(null);
            setStreamingText(event.payload.fullText || ((prev) => prev + event.payload.delta));
          }
        });
        unlistenChunkRef.current = uChunk;

        const uEnd = await listen<AiStreamEndPayload>('limen://ai-stream-end', (event) => {
          if (currentSeq !== seq.current) return;
          if (event.payload.ticket === preview.ticket) {
            setIsStreaming(false);
            setLoadingStep(null);
            if (event.payload.cancelled && (event.payload.error?.includes('Un documento è cambiato') || event.payload.status === 'error')) {
              setAnswer({
                answer: event.payload.answer || 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
                provider: 'OpenAI',
                model: currentModel,
                citations: [],
                status: 'error',
                warning: event.payload.answer,
              });
              setStreamingText('');
            } else if (event.payload.incomplete || event.payload.cancelled) {
              setAnswer({
                answer: event.payload.answer,
                provider: 'OpenAI',
                model: currentModel,
                citations: [],
                incomplete: true,
                incompleteReason: event.payload.incompleteReason || 'La generazione della risposta è stata interrotta.',
                warning: 'Risposta parziale: generazione interrotta prima del completamento.',
              });
            }
          }
        });
        unlistenEndRef.current = uEnd;
      } catch (errListener) {
        console.warn('[LIMEN] listen streaming non registrato (fallback browser o headless):', errListener);
      }

      // Step 3: Invoca askStream
      const uiPreviewElapsed = Math.round(Date.now() - t0);
      const res = await aiIpc.askStream(preview.ticket, uiPreviewElapsed);

      if (currentSeq !== seq.current) return;
      res.uiTotalMs = Math.round(Date.now() - t0);
      setIsStreaming(false);
      setStreamingText('');
      setAnswer(res);
      saveOperation.current = operationId();
    } catch (e: any) {
      if (currentSeq !== seq.current) return;
      setIsStreaming(false);
      const errStr = String(e?.message || e);
      if (errStr.includes('Un documento è cambiato durante la generazione')) {
        // Regola vincolante: testo sostituito per intero da messaggio errore e 0 citazioni
        setStreamingText('');
        setAnswer({
          answer: 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
          provider: 'OpenAI',
          model: currentModel,
          citations: [],
          status: 'error',
          warning: 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
        });
      } else if (errStr.includes('Consenso')) {
        setConsentGranted(false);
      } else {
        setError('Impossibile completare la risposta. Verifica la connessione o la chiave API.');
        setTechError(errStr);
      }
    } finally {
      if (currentSeq === seq.current) {
        setLoadingStep(null);
        setIsStreaming(false);
        if (unlistenChunkRef.current) {
          unlistenChunkRef.current();
          unlistenChunkRef.current = null;
        }
        if (unlistenEndRef.current) {
          unlistenEndRef.current();
          unlistenEndRef.current = null;
        }
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
          {/* Model selection row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <label htmlFor="ai-model-select" style={{ fontSize: 13, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                Modello:
              </label>
              <select
                id="ai-model-select"
                aria-label="Seleziona modello AI"
                value={model}
                onChange={e => void handleModelChange(e.target.value)}
                style={{
                  ...fieldStyle,
                  width: 'auto',
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: 13,
                  borderColor: !model ? '#f59e0b' : '#cbd5e1',
                  backgroundColor: !model ? '#fffbeb' : '#ffffff',
                }}
              >
                {!model && <option value="">-- Seleziona un modello --</option>}
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {model && !availableModels.includes(model) && (
                  <option key={model} value={model}>{model}</option>
                )}
              </select>
            </div>
            {!model && (
              <span style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>
                ⚠️ Seleziona un modello per poter procedere
              </span>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              aria-label="Domanda al Vault"
              placeholder={model ? "Es. Cosa è il progetto BNXT e quali requisiti prevede?" : "Seleziona prima un modello sopra per fare una domanda..."}
              maxLength={2000}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (prompt.trim() && model) executeAsk(prompt.trim());
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
                opacity: (!model || !prompt.trim() || !!loadingStep) ? 0.6 : 1,
              }}
              disabled={!!loadingStep || !prompt.trim() || !model}
              onClick={() => prompt.trim() && model && executeAsk(prompt.trim())}
              title={!model ? "Seleziona un modello per abilitare l'invio" : undefined}
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

      {/* Fonti consultate dal Vault per questa domanda — Mostrate SUBITO appena la preview è pronta */}
      {previewData && previewData.sources && previewData.sources.length > 0 && (
        <div className="limen-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left',
              }}
            >
              {sourcesOpen ? <ChevronDown size={18} color="#0f172a" /> : <ChevronRight size={18} color="#0f172a" />}
              <FileText size={18} color="#0f172a" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                Fonti consultate dal Vault per questa domanda ({previewData.sources.length})
              </h3>
            </button>
            {isStreaming && (
              <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} className="animate-spin" /> Ricezione streaming…
              </span>
            )}
          </div>

          {sourcesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {previewData.sources.map((s, idx) => {
                const clean = cleanTitle(s.title, s.relativePath);
                const isCited = Boolean(answer?.citations && answer.citations.some(c => c.documentId === s.documentId || c.relativePath === s.relativePath));
                return (
                  <div
                    key={`${s.documentId}-${idx}`}
                    onClick={() => {
                      if (onOpenDocument) {
                        onOpenDocument({
                          documentId: s.documentId,
                          passageId: s.passageId,
                          locator: s.locator,
                          revision: s.revision,
                          sha256: s.sha256,
                        });
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: isCited ? '#f0fdf4' : '#f8fafc',
                      border: isCited ? '1px solid #86efac' : '1px solid #e2e8f0',
                      cursor: onOpenDocument ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <FileText size={15} color={isCited ? '#16a34a' : '#64748b'} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: isCited ? 700 : 500, color: isCited ? '#14532d' : '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {clean}
                      </span>
                      {s.category && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: isCited ? '#dcfce7' : '#e2e8f0',
                            color: isCited ? '#166534' : '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {s.category}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isCited && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: '#22c55e',
                            color: '#ffffff',
                            letterSpacing: '0.04em',
                          }}
                        >
                          CITATA
                        </span>
                      )}
                      {s.locator && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: isCited ? '#ecfdf5' : '#eff6ff',
                            color: isCited ? '#047857' : '#1d4ed8',
                            border: isCited ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                          }}
                        >
                          {s.locator}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dicitura trasparente: "Basata su N documenti citati tra M consultati" quando la risposta è pronta */}
          {answer && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
              Basata su {answer.citations?.length || 0} document{answer.citations?.length === 1 ? 'o citato' : 'i citati'} tra {previewData.sources.length} consultat{previewData.sources.length === 1 ? 'o' : 'i'}
            </div>
          )}
        </div>
      )}

      {/* Box di generazione progressiva in streaming */}
      {isStreaming && (
        <div className="limen-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontSize: 13, fontWeight: 600 }}>
            <Sparkles size={16} className="animate-spin" />
            <span>Generazione in streaming con OpenAI ({model || 'gpt-4o'})…</span>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
            {streamingText || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Elaborazione in corso e attesa token…</span>}
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 16,
                backgroundColor: '#2563eb',
                marginLeft: 4,
                verticalAlign: 'text-bottom',
                animation: 'pulse 1s infinite',
              }}
            />
          </div>
        </div>
      )}

      {/* Prose Answer Result Block */}
      {answer && !loadingStep && !isStreaming && (
        <div className="limen-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sostituzione protettiva testo per errore verify_post */}
          {answer.status === 'error' && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
              <div>
                <strong>Attenzione:</strong> {answer.answer}
              </div>
            </div>
          )}

          {/* Banner Risposta Incompleta per modelli con limite token o stream interrotto */}
          {answer.incomplete && answer.status !== 'error' && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
              <div>
                <strong>Risposta incompleta:</strong>{' '}
                {answer.incompleteReason === 'max_output_tokens'
                  ? 'Il modello ha raggiunto il limite massimo di token generabili. La risposta parziale è stata preservata con 0 citazioni.'
                  : (answer.incompleteReason || 'La generazione della risposta è stata interrotta. La risposta parziale è stata preservata con 0 citazioni.')}
              </div>
            </div>
          )}

          {/* Answer Foreground Prose */}
          {answer.status !== 'error' && (
            <div style={{ fontSize: 15, lineHeight: 1.7, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
              {answer.answer}
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
              disabled={!!saveMessage || answer.status === 'error'}
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
                <div><strong>Stato risposta:</strong> {answer.status || (answer.incomplete ? 'incompleta' : 'completa')} {answer.incompleteReason ? `(${answer.incompleteReason})` : ''}</div>
                <div>
                  <strong>Token usati:</strong> {answer.tokensUsed ?? 'N/A'}
                  {(answer.tokensPrompt !== undefined || answer.tokensCompletion !== undefined) && (
                    <span> (input: {answer.tokensPrompt ?? 'N/A'}, output: {answer.tokensCompletion ?? 'N/A'}{answer.tokensReasoning !== undefined ? `, ragionamento: ${answer.tokensReasoning}` : ''})</span>
                  )}
                </div>
                {answer.uiTotalMs && <div><strong>Tempo interfaccia (totale):</strong> {(answer.uiTotalMs / 1000).toFixed(1)} s ({answer.uiTotalMs} ms)</div>}
                {previewData && <div><strong>Dimensione contesto:</strong> {previewData.contextBytes} byte (passaggi consultati: {previewData.sources.length})</div>}
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
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<{ active: boolean; endpoint?: string; vaultId?: string; token?: string }>({ active: false });

  useEffect(() => {
    void aiIpc.mcpStatus().then(setConnection).catch(e => setMessage(String(e)));
    void aiIpc.getConsent(vaultPath).then(setConsent).catch(() => {});
    void aiIpc.models().then(m => { if (m && m.length > 0) setAvailableModels(m); }).catch(() => {});
    void aiIpc.getSelectedModel().then(m => {
      if (m) setSelectedModel(m);
      else setSelectedModel('gpt-4o');
    }).catch(() => {
      setSelectedModel('gpt-4o');
    });
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
              aria-label="Modello OpenAI predefinito"
              value={selectedModel || 'gpt-4o'}
              onChange={e => {
                const val = e.target.value;
                setSelectedModel(val);
                void aiIpc.saveSelectedModel(val);
              }}
              style={fieldStyle}
            >
              {(() => {
                const list = availableModels.includes('gpt-4o')
                  ? availableModels
                  : ['gpt-4o', ...availableModels.filter(m => m !== 'gpt-4o')];
                return list.map(m => (
                  <option key={m} value={m}>{m}</option>
                ));
              })()}
              {selectedModel && !availableModels.includes(selectedModel) && selectedModel !== 'gpt-4o' && (
                <option key={selectedModel} value={selectedModel}>{selectedModel}</option>
              )}
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
