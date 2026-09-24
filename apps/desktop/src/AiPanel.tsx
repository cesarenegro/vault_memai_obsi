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

export interface AiPanelProps {
  vaultPath: string;
  onOpenDocument?: (req: CitationOpenRequest) => void;
  archivedConversation?: {
    conversationId: string;
    turns: ConversationTurnItem[];
  } | null;
  onNewConversation?: () => void;
  onHistoryUpdated?: () => void;
  onSelectedTurnChange?: (turn: ConversationTurnItem | null) => void;
  selectedTurnIndex?: number;
  onSelectTurnIndex?: (index: number) => void;
  onOpenSourcesSidebar?: () => void;
  newConversationTrigger?: number;
}

export function AiPanel({
  vaultPath,
  onOpenDocument,
  archivedConversation,
  onNewConversation,
  onHistoryUpdated,
  onSelectedTurnChange,
  selectedTurnIndex,
  onSelectTurnIndex,
  onOpenSourcesSidebar,
  newConversationTrigger,
}: AiPanelProps) {
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
  const [previewData, setPreviewData] = useState<AiPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [techError, setTechError] = useState<string | null>(null);

  const isArchived = Boolean(archivedConversation);
  const effectiveTurns = archivedConversation ? archivedConversation.turns : turns;
  const activeTurnIndex =
    typeof selectedTurnIndex === 'number' && selectedTurnIndex >= 0 && selectedTurnIndex < effectiveTurns.length
      ? selectedTurnIndex
      : effectiveTurns.length - 1;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Notifica la risposta selezionata al genitore
  useEffect(() => {
    const currentSelected = effectiveTurns[activeTurnIndex] || null;
    onSelectedTurnChange?.(currentSelected);
  }, [activeTurnIndex, effectiveTurns, onSelectedTurnChange]);

  const seq = useRef(0);
  const unlistenChunkRef = useRef<UnlistenFn | null>(null);
  const unlistenEndRef = useRef<UnlistenFn | null>(null);
  const isRunningRef = useRef(false);
  const isBusy = !!loadingStep || isStreaming;

  // Scorrimento automatico all'ultimo messaggio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [effectiveTurns.length, streamingText, isBusy, isArchived]);

  // Gestione trigger nuova conversazione
  useEffect(() => {
    if (newConversationTrigger) {
      handleNewConversation();
    }
  }, [newConversationTrigger]);

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
    setLoadingStep(null);
    onNewConversation?.();
  }

  async function handleSaveDraft(turnIdx: number) {
    const turn = effectiveTurns[turnIdx];
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
      if (!isArchived) {
        setTurns(prev => prev.map((t, idx) => idx === turnIdx ? { ...t, saveMessage: 'Bozza salvata in locale.' } : t));
      }
    } catch (e) {
      setError(String(e));
    }
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
      const newTurn: ConversationTurnItem = {
        id: res.historyEntryId || `turn_${Date.now()}`,
        prompt: queryText,
        answer: res,
        previewData: preview,
      };
      setTurns(prev => {
        const next = [...prev, newTurn];
        onSelectTurnIndex?.(next.length - 1);
        return next;
      });
      setActivePrompt('');
      setPreviewData(null);
      onHistoryUpdated?.();
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
          }
        ]);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 24px',
          borderBottom: '1px solid var(--limen-border-light)',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#0f172a" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Chiedi al Vault</span>
          </div>

          {isArchived ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <Lock size={12} />
              Conversazione archiviata
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="ai-model-select" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                Modello:
              </label>
              <select
                id="ai-model-select"
                aria-label="Seleziona modello AI"
                value={model}
                onChange={e => void handleModelChange(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                {!model && <option value="">-- Seleziona --</option>}
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {model && !availableModels.includes(model) && (
                  <option key={model} value={model}>{model}</option>
                )}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isArchived ? (
            <button
              onClick={onNewConversation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} />
              <span>Nuova conversazione</span>
            </button>
          ) : (
            effectiveTurns.length > 0 && (
              <button
                onClick={handleNewConversation}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PlusCircle size={14} />
                <span>Nuova conversazione</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Area Messaggi a Scorrimento Continuo */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {effectiveTurns.length === 0 && !isBusy && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b', maxWidth: 460 }}>
            <Sparkles size={36} color="#0f172a" style={{ marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Chiedi al Vault
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#475569' }}>
              Fai una domanda per ottenere una risposta in prosa sintetizzata direttamente dai tuoi documenti. Per domande di seguito, la conversazione mantiene il contesto precedente.
            </p>
          </div>
        )}

        {/* Turni in sequenza continua */}
        {effectiveTurns.map((turn, tIdx) => {
          const isSelected = activeTurnIndex === tIdx;
          const citedCount = turn.answer.citations?.length || 0;
          const totalConsulted = turn.previewData?.sources?.length || 0;

          return (
            <div key={turn.id || tIdx} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 1. Domanda utente a destra con verde lime 60% */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '12px 18px',
                    backgroundColor: 'var(--limen-lime-60)',
                    color: '#0f172a',
                    borderRadius: '16px 16px 4px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      Turno {turn.answer.turnIndex ?? (tIdx + 1)}
                    </span>
                    <span style={{ fontSize: 11, color: '#0f172a', opacity: 0.8, fontWeight: 600 }}>
                      {turn.answer.model}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {turn.prompt}
                  </div>
                </div>
              </div>

              {/* 2. Risposta dell'AI a sinistra in riquadro bianco */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div
                  className="limen-card"
                  onClick={() => {
                    onSelectTurnIndex?.(tIdx);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '92%',
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    backgroundColor: '#ffffff',
                    border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                    boxShadow: isSelected ? '0 0 0 2px rgba(15, 23, 42, 0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {turn.answer.status === 'error' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertCircle size={18} style={{ flexShrink: 0, color: '#dc2626' }} />
                      <div><strong>Attenzione:</strong> {turn.answer.answer}</div>
                    </div>
                  )}

                  {turn.answer.incomplete && turn.answer.status !== 'error' && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0, color: '#d97706' }} />
                      <div>
                        <strong>Risposta incompleta:</strong>{' '}
                        {turn.answer.incompleteReason || 'La generazione della risposta è stata interrotta.'}
                      </div>
                    </div>
                  )}

                  {turn.answer.status !== 'error' && (
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                      {turn.answer.answer}
                    </div>
                  )}

                  {/* Indicazione discreta delle fonti & Azioni */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTurnIndex?.(tIdx);
                          onOpenSourcesSidebar?.();
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 16,
                          border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? '#0f172a' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Clicca per aprire le fonti di questa risposta nella barra laterale"
                      >
                        <FileText size={12} color={isSelected ? '#ffffff' : '#64748b'} />
                        <span>
                          {citedCount} font{citedCount === 1 ? 'e citata' : 'i citate'}
                          {totalConsulted > citedCount ? ` (${totalConsulted} consultate)` : ''}
                        </span>
                      </button>

                      {!isArchived && (
                        <button
                          style={{
                            ...primaryButtonStyle,
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            fontSize: 11,
                            padding: '4px 10px',
                          }}
                          disabled={!!turn.saveMessage || turn.answer.status === 'error'}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSaveDraft(tIdx);
                          }}
                        >
                          {turn.saveMessage || 'Salva bozza'}
                        </button>
                      )}
                    </div>

                    <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                      OpenAI · {turn.answer.model}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming in elaborazione */}
        {isBusy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '12px 18px',
                  backgroundColor: 'var(--limen-lime-60)',
                  color: '#0f172a',
                  borderRadius: '16px 16px 4px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 10,
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
                      if (previewData?.ticket) void aiIpc.cancel(previewData.ticket);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: 'none',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
              <div className="limen-card" style={{ width: '100%', maxWidth: '92%', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: '#ffffff' }}>
                {loadingStep && (
                  <div style={{ textAlign: 'center', color: '#475569', padding: '10px 0' }}>
                    <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 6 }}>
                      <Sparkles size={20} color="#0f172a" />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{loadingStep}</p>
                  </div>
                )}
                {isStreaming && (
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                    {streamingText || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Elaborazione in corso e attesa token…</span>}
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 15,
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
          </div>
        )}

        {/* Errori e avvisi */}
        {error && !loadingStep && (
          <div
            style={{
              padding: 14,
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

        {consentGranted === false && (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              backgroundColor: '#fffbe6',
              border: '1px solid #ffe58f',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ShieldAlert size={20} color="#d48806" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600, color: '#d48806' }}>
                  Consenso all’invio dei dati richiesto
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#595959', lineHeight: 1.4 }}>
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
                  fontSize: 12,
                  padding: '6px 14px',
                }}
              >
                <Check size={14} />
                Consenti l’invio a OpenAI e genera risposta
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Casella di Scrittura FISSA in Basso */}
      <div
        style={{
          flexShrink: 0,
          padding: '14px 24px',
          borderTop: '1px solid var(--limen-border-light)',
          backgroundColor: '#ffffff',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
        }}
      >
        {isArchived ? (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 13 }}>
              <Lock size={16} color="#64748b" />
              <span><strong>Conversazione archiviata:</strong> consultazione in sola lettura. Non è possibile proseguire.</span>
            </div>
            <button
              onClick={onNewConversation}
              style={{
                ...primaryButtonStyle,
                padding: '6px 14px',
                fontSize: 12,
              }}
            >
              <PlusCircle size={14} />
              <span>Nuova conversazione</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <textarea
                aria-label="Domanda al Vault"
                placeholder={
                  !model
                    ? 'Seleziona prima un modello per fare una domanda...'
                    : effectiveTurns.length === 0
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
                  minHeight: 75,
                  resize: 'vertical',
                  paddingRight: 100,
                  fontSize: 14,
                  lineHeight: 1.5,
                  backgroundColor: 'var(--limen-lime-30)',
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
        )}
      </div>
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
