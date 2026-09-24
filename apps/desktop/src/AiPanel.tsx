import React, { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { aiIpc, type AiAnswer, type AiPreview, type AiSource, type AiStreamChunkPayload, type AiStreamEndPayload } from './ai-ipc';
import type { CitationOpenRequest } from './vault-ipc';
import { labelIt, MessageIt } from './locale';
import { SemanticEngineSettings } from './SemanticEngineSettings';
import { TunnelPanel } from './TunnelPanel';
import { getPlatformTerms } from './platform';
import { m7, operationId } from './proposal-ipc';
import { ChevronDown, ChevronRight, ShieldAlert, Sparkles, FileText, Check, AlertCircle, Key, Lock, Clock, PlusCircle } from 'lucide-react';
import { AiHistoryDrawer } from './AiHistoryDrawer';
import { historyIpc } from './history-ipc';
import { cleanTitle, formatSourceCategory, formatLocator, formatSourceLabel } from './source-utils';

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

export interface ConversationTurnItem {
  id: string;
  prompt: string;
  answer: AiAnswer;
  previewData?: AiPreview;
  saveMessage?: string;
  techDetailsOpen?: boolean;
  sourcesOpen?: boolean;
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
  const [activePrompt, setActivePrompt] = useState('');
  const [model, setModel] = useState<string>('gpt-4o');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(false);
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurnItem[]>([]);

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSourcesOpen, setStreamingSourcesOpen] = useState(false);
  const [previewData, setPreviewData] = useState<AiPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [techError, setTechError] = useState<string | null>(null);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState<number>(0);

  useEffect(() => {
    if (vaultPath) {
      void historyIpc.list(vaultPath).then(l => setHistoryCount(l.length)).catch(() => {});
    }
  }, [vaultPath]);

  const seq = useRef(0);
  const unlistenChunkRef = useRef<UnlistenFn | null>(null);
  const unlistenEndRef = useRef<UnlistenFn | null>(null);
  const isRunningRef = useRef(false);
  const isBusy = !!loadingStep || isStreaming;

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
      if (!isBusy && prompt.trim()) {
        void executeAsk(prompt.trim());
      }
    } catch (e) {
      setError('Impossibile aggiornare il consenso.');
      setTechError(String(e));
    }
  }

  function handleNewConversation() {
    if (isBusy && previewData?.ticket) {
      void aiIpc.cancel(previewData.ticket);
    }
    setConversationId(null);
    setTurns([]);
    setPrompt('');
    setActivePrompt('');
    setError(null);
    setTechError(null);
    setPreviewData(null);
    setStreamingText('');
    setIsStreaming(false);
    setStreamingSourcesOpen(false);
    setLoadingStep(null);
  }

  async function handleSaveDraft(turnIdx: number) {
    const turn = turns[turnIdx];
    if (!turn || !turn.answer) return;
    try {
      await m7(vaultPath, {
        action: 'save',
        operationId: operationId(),
        title: turn.prompt.slice(0, 200),
        content: turn.answer.answer,
        provider: turn.answer.provider,
        model: turn.answer.model,
        sources: turn.answer.citations,
      });
      setTurns(prev => prev.map((t, idx) => idx === turnIdx ? { ...t, saveMessage: 'Bozza salvata in locale.' } : t));
    } catch (e) {
      setError(String(e));
    }
  }

  function toggleTurnSources(turnIdx: number) {
    setTurns(prev => prev.map((t, idx) => idx === turnIdx ? { ...t, sourcesOpen: !(t.sourcesOpen ?? false) } : t));
  }

  function toggleTurnTechDetails(turnIdx: number) {
    setTurns(prev => prev.map((t, idx) => idx === turnIdx ? { ...t, techDetailsOpen: !t.techDetailsOpen } : t));
  }

  async function executeAsk(queryText: string) {
    if (!queryText || isRunningRef.current || loadingStep || isStreaming) return;
    isRunningRef.current = true;
    const currentModel = model || 'gpt-4o';
    setActivePrompt(queryText);
    setPrompt('');

    const currentSeq = ++seq.current;
    setError(null);
    setTechError(null);
    setPreviewData(null);
    setStreamingText('');
    setIsStreaming(false);
    setStreamingSourcesOpen(false);

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
      isRunningRef.current = false;
      return;
    }

    setLoadingStep('Selezione passaggi pertinenti dal Vault…');
    const t0 = Date.now();

    // Contesto al modello: per ogni domanda di seguito si inviano, oltre alle fonti,
    // le ultime 3 coppie domanda-risposta della stessa conversazione come testo nella richiesta.
    const completedTurns = turns
      .filter(t => t.answer && t.answer.status !== 'error')
      .map(t => ({ question: t.prompt, answer: t.answer.answer }));
    const previousTurns = completedTurns.slice(-3);
    const previousQuestion = completedTurns.length > 0 ? completedTurns[completedTurns.length - 1].question : undefined;
    const parentEntryId = turns.length > 0 ? turns[turns.length - 1].answer.historyEntryId : undefined;
    const turnIndex = turns.length + 1;

    try {
      // Step 1: Preview / Select sources automaticamente
      const preview = await aiIpc.preview(vaultPath, {
        prompt: queryText,
        model: currentModel,
        includeDrafts: drafts,
        sourceIds: [],
        conversationId: conversationId || undefined,
        turnIndex,
        parentEntryId,
        previousTurns,
        previousQuestion,
      });

      if (currentSeq !== seq.current) return;
      setPreviewData(preview);

      if (preview.sources.length === 0) {
        setLoadingStep(null);
        setError('Nessun passaggio pertinente trovato nel Vault per questa domanda.');
        return;
      }

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
              const errAns: AiAnswer = {
                answer: event.payload.answer || 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
                provider: 'OpenAI',
                model: currentModel,
                citations: [],
                status: 'error',
                warning: event.payload.answer,
              };
              setTurns(prev => [
                ...prev,
                {
                  id: `err_${Date.now()}`,
                  prompt: queryText,
                  answer: errAns,
                  previewData: preview,
                  sourcesOpen: true,
                }
              ]);
              setStreamingText('');
              setActivePrompt('');
              setPreviewData(null);
            } else if (event.payload.incomplete || event.payload.cancelled) {
              const incAns: AiAnswer = {
                answer: event.payload.answer,
                provider: 'OpenAI',
                model: currentModel,
                citations: [],
                incomplete: true,
                incompleteReason: event.payload.incompleteReason || 'La generazione della risposta è stata interrotta.',
                warning: 'Risposta parziale: generazione interrotta prima del completamento.',
              };
              setTurns(prev => [
                ...prev,
                {
                  id: event.payload.historyEntryId || `inc_${Date.now()}`,
                  prompt: queryText,
                  answer: incAns,
                  previewData: preview,
                  sourcesOpen: true,
                }
              ]);
              setStreamingText('');
              setActivePrompt('');
              setPreviewData(null);
              if (event.payload.conversationId) {
                setConversationId(event.payload.conversationId);
              }
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
      setLoadingStep(null);
      if (res.conversationId) {
        setConversationId(res.conversationId);
      }
      setTurns(prev => [
        ...prev,
        {
          id: res.historyEntryId || `turn_${Date.now()}`,
          prompt: queryText,
          answer: res,
          previewData: preview,
          sourcesOpen: false,
        }
      ]);
      setActivePrompt('');
      setPreviewData(null);
      setHistoryCount(c => c + 1);
    } catch (e: any) {
      if (currentSeq !== seq.current) return;
      setIsStreaming(false);
      const errStr = String(e?.message || e);
      if (errStr.includes('Un documento è cambiato durante la generazione')) {
        const docErrAns: AiAnswer = {
          answer: 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
          provider: 'OpenAI',
          model: currentModel,
          citations: [],
          status: 'error',
          warning: 'Un documento è cambiato durante la generazione: la risposta è stata annullata, riprova',
        };
        setTurns(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            prompt: queryText,
            answer: docErrAns,
            previewData: previewData || undefined,
            sourcesOpen: false,
          }
        ]);
        setStreamingText('');
        setActivePrompt('');
        setPreviewData(null);
      } else if (errStr.includes('Consenso')) {
        setConsentGranted(false);
      } else if (errStr.includes('An AI request is already running') || errStr.includes('già una domanda in corso')) {
        setError("C'è già una domanda in corso: attendi la risposta o annullala.");
        setTechError(null);
      } else if (errStr.includes('Errore interno durante la generazione della risposta')) {
        setError('Errore interno durante la generazione della risposta, riprova.');
        setTechError(null);
      } else {
        setError('Impossibile completare la risposta. Verifica la connessione o la chiave API.');
        setTechError(errStr);
      }
    } finally {
      isRunningRef.current = false;
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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Card with Nuova conversazione and Storico */}
      <div className="limen-card" style={{ padding: 20, backgroundColor: 'var(--limen-lime-30)', border: '1px solid rgba(119, 241, 23, 0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} color="#0f172a" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>
              Chiedi al Vault
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleNewConversation}
              style={{
                padding: '6px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#ffffff',
                color: '#0f172a',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Apre una nuova conversazione azzerando il contesto precedente"
            >
              <PlusCircle size={16} />
              <span>Nuova conversazione</span>
            </button>
            <button
              onClick={() => setHistoryDrawerOpen(true)}
              style={{
                padding: '6px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#ffffff',
                color: '#334155',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Apri lo storico delle domande e risposte"
            >
              <Clock size={16} />
              <span>Storico</span>
              {historyCount > 0 && (
                <span
                  style={{
                    background: '#0f172a',
                    color: 'white',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {historyCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
          Fai una domanda per ottenere una risposta in prosa sintetizzata direttamente dai tuoi documenti. Per domande di seguito, la conversazione mantiene il contesto precedente.
        </p>

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
      </div>

      {/* Conversazione mostrata in stile messaggistica */}
      {turns.map((turn, tIdx) => {
        const citedCount = turn.answer.citations?.length || 0;
        const totalConsulted = turn.previewData?.sources.length || 0;
        const isSourcesOpen = turn.sourcesOpen ?? false;

        return (
          <div key={turn.id || tIdx} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 1. Domanda utente allineata a destra in verde lime */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '14px 18px',
                  backgroundColor: 'var(--limen-lime)',
                  color: '#0f172a',
                  borderRadius: '16px 16px 4px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Turno {turn.answer.turnIndex ?? (tIdx + 1)}
                  </span>
                  <span style={{ fontSize: 11, color: '#0f172a', opacity: 0.8, fontWeight: 600 }}>
                    {turn.answer.model}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {turn.prompt}
                </div>
              </div>
            </div>

            {/* 2. Risposta dell'AI allineata a sinistra in riquadro bianco */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
              <div className="limen-card" style={{ width: '100%', maxWidth: '92%', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: '#ffffff' }}>
                {turn.answer.status === 'error' && (
                  <div
                    style={{
                      padding: '12px 16px',
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
                    <div><strong>Attenzione:</strong> {turn.answer.answer}</div>
                  </div>
                )}

                {turn.answer.incomplete && turn.answer.status !== 'error' && (
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
                      {turn.answer.incompleteReason || 'La generazione della risposta è stata interrotta. La risposta parziale è stata preservata con 0 citazioni.'}
                    </div>
                  </div>
                )}

                {turn.answer.status !== 'error' && (
                  <div style={{ fontSize: 15, lineHeight: 1.7, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                    {turn.answer.answer}
                  </div>
                )}

                {/* Save as Draft & Technical Details */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 14, flexWrap: 'wrap', gap: 10 }}>
                  <button
                    style={{
                      ...primaryButtonStyle,
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      padding: '6px 14px',
                    }}
                    disabled={!!turn.saveMessage || turn.answer.status === 'error'}
                    onClick={() => void handleSaveDraft(tIdx)}
                  >
                    {turn.saveMessage || 'Salva risposta come bozza'}
                  </button>

                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                    Risposta generata con OpenAI ({turn.answer.model})
                  </span>
                </div>

                {/* Technical details accordion */}
                <div style={{ marginTop: 2 }}>
                  <details
                    open={turn.techDetailsOpen}
                    onToggle={() => toggleTurnTechDetails(tIdx)}
                    style={{ fontSize: 12, color: '#64748b' }}
                  >
                    <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#64748b' }}>
                      Dettagli tecnici
                    </summary>
                    <div style={{ marginTop: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div><strong>Fornitore:</strong> {turn.answer.provider}</div>
                      <div><strong>Modello:</strong> {turn.answer.model}</div>
                      <div><strong>Stato risposta:</strong> {turn.answer.status || (turn.answer.incomplete ? 'incompleta' : 'completa')} {turn.answer.incompleteReason ? `(${turn.answer.incompleteReason})` : ''}</div>
                      <div>
                        <strong>Token usati:</strong> {turn.answer.tokensUsed ?? 'N/A'}
                        {(turn.answer.tokensPrompt !== undefined || turn.answer.tokensCompletion !== undefined) && (
                          <span> (input: {turn.answer.tokensPrompt ?? 'N/A'}, output: {turn.answer.tokensCompletion ?? 'N/A'}{turn.answer.tokensReasoning !== undefined ? `, ragionamento: ${turn.answer.tokensReasoning}` : ''})</span>
                        )}
                      </div>
                      {turn.answer.uiTotalMs && <div><strong>Tempo interfaccia (totale):</strong> {(turn.answer.uiTotalMs / 1000).toFixed(1)} s ({turn.answer.uiTotalMs} ms)</div>}
                      {turn.previewData && <div><strong>Dimensione contesto:</strong> {turn.previewData.contextBytes} byte (passaggi consultati: {turn.previewData.sources.length})</div>}
                      <div>
                        <strong>Ricerca semantica:</strong>{' '}
                        {(turn.answer.semanticUsed ?? turn.previewData?.semanticUsed) ? (
                          <span style={{ color: '#166534', fontWeight: 600 }}>Attiva (bge-m3 1024d)</span>
                        ) : (
                          <span style={{ color: '#b45309' }}>Non attiva — {turn.answer.semanticFallbackReason || turn.previewData?.semanticFallbackReason || 'Ripiego su ricerca per parole'}</span>
                        )}
                      </div>
                      <div><strong>Citazioni grezze:</strong></div>
                      {turn.answer.citations.map((c, i) => (
                        <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>
                          • {c.documentId} | SHA256: {c.sha256} | Path: {c.relativePath}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>

            {/* 3. Fonti consultate SOTTO la risposta in ogni turno, richiuse di default */}
            {turn.previewData && turn.previewData.sources && turn.previewData.sources.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div className="limen-card" style={{ width: '100%', maxWidth: '92%', padding: 16, backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSourcesOpen ? 12 : 0 }}>
                    <button
                      onClick={() => toggleTurnSources(tIdx)}
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
                      {isSourcesOpen ? <ChevronDown size={18} color="#0f172a" /> : <ChevronRight size={18} color="#0f172a" />}
                      <FileText size={18} color="#0f172a" />
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                        Fonti consultate dal Vault ({turn.previewData.sources.length})
                      </h3>
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                      {citedCount} citat{citedCount === 1 ? 'o' : 'i'} tra {totalConsulted} consultat{totalConsulted === 1 ? 'o' : 'i'}
                    </span>
                  </div>

                  {isSourcesOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          backgroundColor: turn.previewData.semanticUsed ? '#f0fdf4' : '#fffbeb',
                          border: turn.previewData.semanticUsed ? '1px solid #bbf7d0' : '1px solid #fde68a',
                          color: turn.previewData.semanticUsed ? '#166534' : '#92400e',
                        }}
                      >
                        <Sparkles size={14} color={turn.previewData.semanticUsed ? '#16a34a' : '#d97706'} style={{ flexShrink: 0 }} />
                        {turn.previewData.semanticUsed ? (
                          <span><strong>Ricerca semantica attiva:</strong> passaggi selezionati e ordinati con modello locale bge-m3</span>
                        ) : (
                          <span><strong>Ricerca per parole chiave (ripiego):</strong> {turn.previewData.semanticFallbackReason || 'servizio locale non disponibile'}</span>
                        )}
                      </div>

                      {turn.previewData.sources.map((s, sIdx) => {
                        const isCited = Boolean(turn.answer.citations && turn.answer.citations.some(c => c.documentId === s.documentId || c.relativePath === s.relativePath));
                        return (
                          <div
                            key={`${s.documentId}-${sIdx}`}
                            onClick={() => {
                              if (onOpenDocument) {
                                const pHashPair = s.passageHashes?.find(([pid]) => pid === s.passageId);
                                const pHash = pHashPair ? pHashPair[1] : undefined;
                                if (pHash && s.passageId) {
                                  onOpenDocument({
                                    documentId: s.documentId,
                                    passageId: s.passageId,
                                    locator: s.locator,
                                    revision: s.revision,
                                    sha256: pHash,
                                  });
                                } else {
                                  onOpenDocument({
                                    documentId: s.documentId,
                                    locator: s.locator,
                                    revision: s.revision,
                                    sha256: s.sha256,
                                  });
                                }
                              }
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              backgroundColor: isCited ? '#f0fdf4' : '#ffffff',
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
                                {formatSourceLabel(s.title, s.relativePath, s.category, s.locator)}
                              </span>
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Ongoing Streaming Turn (in elaborazione) */}
      {isBusy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Domanda in corso allineata a destra in verde lime */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <div
              style={{
                maxWidth: '85%',
                padding: '14px 18px',
                backgroundColor: 'var(--limen-lime)',
                color: '#0f172a',
                borderRadius: '16px 16px 4px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Turno {turns.length + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                  {activePrompt}
                </span>
              </div>
              {previewData?.ticket && (
                <button
                  type="button"
                  onClick={() => {
                    if (previewData?.ticket) {
                      void aiIpc.cancel(previewData.ticket);
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #0f172a',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Annulla domanda
                </button>
              )}
            </div>
          </div>

          {/* Streaming Box allineato a sinistra in bianco */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
            <div className="limen-card" style={{ width: '100%', maxWidth: '92%', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: '#ffffff' }}>
              {loadingStep && (
                <div style={{ textAlign: 'center', color: '#475569' }}>
                  <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }}>
                    <Sparkles size={24} color="#0f172a" />
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{loadingStep}</p>
                </div>
              )}
              {isStreaming && (
                <div style={{ fontSize: 15, lineHeight: 1.7, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                  {streamingText || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Elaborazione in corso e attesa token…</span>}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 16,
                      backgroundColor: '#0f172a',
                      marginLeft: 4,
                      verticalAlign: 'text-bottom',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Fonti consultate preview SOTTO lo streaming box, richiuse di default */}
          {previewData && previewData.sources && previewData.sources.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
              <div className="limen-card" style={{ width: '100%', maxWidth: '92%', padding: 16, backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: streamingSourcesOpen ? 10 : 0 }}>
                  <button
                    onClick={() => setStreamingSourcesOpen(o => !o)}
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
                    {streamingSourcesOpen ? <ChevronDown size={18} color="#0f172a" /> : <ChevronRight size={18} color="#0f172a" />}
                    <FileText size={18} color="#0f172a" />
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      Fonti consultate dal Vault per questa domanda ({previewData.sources.length})
                    </h3>
                  </button>
                  <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} className="animate-spin" /> Ricezione streaming…
                  </span>
                </div>

                {streamingSourcesOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {previewData.sources.map((s, sIdx) => (
                      <div
                        key={`${s.documentId}-${sIdx}`}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <FileText size={15} color="#64748b" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {formatSourceLabel(s.title, s.relativePath, s.category, s.locator)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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

      {/* Question Input Box (In calce alla conversazione a filo) */}
      <div className="limen-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              {turns.length === 0 ? 'Fai una domanda al Vault:' : `Domanda di seguito (Turno ${turns.length + 1}):`}
            </span>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={handleNewConversation}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#2563eb',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <PlusCircle size={14} />
                Nuova conversazione
              </button>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              aria-label="Domanda al Vault"
              placeholder={
                !model
                  ? 'Seleziona prima un modello sopra per fare una domanda...'
                  : turns.length === 0
                  ? 'Es. Cosa è il progetto BNXT e quali requisiti prevede?'
                  : 'Fai una domanda di seguito sulla conversazione...'
              }
              maxLength={2000}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isBusy && prompt.trim() && model) void executeAsk(prompt.trim());
                }
              }}
              style={{
                ...fieldStyle,
                minHeight: 85,
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
                opacity: (!model || !prompt.trim() || isBusy) ? 0.6 : 1,
              }}
              disabled={isBusy || !prompt.trim() || !model}
              onClick={() => !isBusy && prompt.trim() && model && void executeAsk(prompt.trim())}
              title={!model ? "Seleziona un modello per abilitare l'invio" : isBusy ? "Generazione in corso..." : undefined}
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

      <AiHistoryDrawer
        vaultPath={vaultPath}
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        onCountChange={count => setHistoryCount(count)}
      />
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
