import React, { useEffect, useState } from 'react';
import {
  historyIpc,
  type HistoryEntry,
  type HistoryEntryHeader,
  type VerifiedSourceResult,
} from './history-ipc';
import { X, Trash2, Clock, AlertTriangle, AlertCircle, FileText, CheckCircle2, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { cleanTitle, formatSourceLabel } from './source-utils';

interface AiHistoryDrawerProps {
  vaultPath: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry?: (entry: HistoryEntry, verifiedSources: VerifiedSourceResult[]) => void;
  onCountChange?: (count: number) => void;
}

export function formatLocalDate(utcString: string): string {
  try {
    const d = new Date(utcString);
    if (isNaN(d.getTime())) return utcString;
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return utcString;
  }
}

export function AiHistoryDrawer({
  vaultPath,
  isOpen,
  onClose,
  onSelectEntry,
  onCountChange,
}: AiHistoryDrawerProps) {
  const [entries, setEntries] = useState<HistoryEntryHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [verifiedSources, setVerifiedSources] = useState<VerifiedSourceResult[] | null>(null);

  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const loadHistory = async () => {
    if (!vaultPath) return;
    setLoading(true);
    setError(null);
    try {
      const vInfo = await historyIpc.getVaultId(vaultPath);
      if (vInfo.duplicateWarning) {
        setDuplicateWarning(vInfo.duplicateWarning);
      } else {
        setDuplicateWarning(null);
      }

      const list = await historyIpc.list(vaultPath);
      setEntries(list);
      if (onCountChange) {
        onCountChange(list.length);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
      setSelectedEntry(null);
      setSourcesOpen(false);
      setVerifiedSources(null);
      setEntryToDelete(null);
      setShowClearConfirm(false);
    }
  }, [isOpen, vaultPath]);

  const handleSelectEntry = async (header: HistoryEntryHeader) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const fullEntry = await historyIpc.get(vaultPath, header.id);
      setSelectedEntry(fullEntry);
      setSourcesOpen(false);
      const verified = await historyIpc.verifySources(vaultPath, fullEntry.sources);
      setVerifiedSources(verified);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setActionInProgress(true);
    try {
      await historyIpc.delete(vaultPath, id);
      setEntryToDelete(null);
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
        setVerifiedSources(null);
      }
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClearHistory = async () => {
    setActionInProgress(true);
    try {
      await historyIpc.clear(vaultPath);
      setShowClearConfirm(false);
      setSelectedEntry(null);
      setVerifiedSources(null);
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setActionInProgress(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        maxWidth: '90vw',
        background: '#ffffff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={20} color="#0f172a" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
            Storico Domande e Risposte
          </h3>
          <span
            style={{
              background: '#e2e8f0',
              color: '#475569',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {entries.length}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            color: '#64748b',
          }}
          title="Chiudi"
        >
          <X size={20} />
        </button>
      </div>

      {/* Warning banner if duplicate vault detected */}
      {duplicateWarning && (
        <div
          style={{
            padding: '10px 16px',
            background: '#fef3c7',
            borderBottom: '1px solid #fde68a',
            color: '#92400e',
            fontSize: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{duplicateWarning}</div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '10px 16px',
            background: '#fee2e2',
            borderBottom: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          <div>{error}</div>
        </div>
      )}

      {/* Main Drawer Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            Caricamento dello storico...
          </div>
        ) : selectedEntry ? (
          /* Detailed Entry View with Live Source Verification */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              onClick={() => {
                setSelectedEntry(null);
                setVerifiedSources(null);
              }}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              ← Torna all'elenco
            </button>

            {/* Entry Meta */}
            <div
              style={{
                padding: 14,
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                    Turno {selectedEntry.turnIndex}
                  </span>
                  <span
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {selectedEntry.responseModel}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {formatLocalDate(selectedEntry.createdAtUtc)}
                </span>
              </div>

              {selectedEntry.status === 'incomplete' && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#b45309',
                    background: '#fef3c7',
                    padding: '2px 6px',
                    borderRadius: 4,
                    alignSelf: 'flex-start',
                    fontWeight: 500,
                  }}
                >
                  Risposta incompleta
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                {selectedEntry.prompt}
              </div>
            </div>

            {/* Answer body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
                Risposta registrata:
              </div>
              <div
                style={{
                  padding: 14,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#1e293b',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {selectedEntry.answer}
              </div>
            </div>

            {/* Sources section with live verification (richiudibile, chiusa all'inizio) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const citedCount = selectedEntry.sources.filter(s => s.cited).length;
                const totalCount = selectedEntry.sources.length;
                return (
                  <button
                    onClick={() => setSourcesOpen(o => !o)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#475569',
                      textTransform: 'uppercase',
                    }}
                  >
                    {sourcesOpen ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
                    <span>
                      Fonti verificate ({citedCount} citat{citedCount === 1 ? 'o' : 'i'} tra {totalCount} consultat{totalCount === 1 ? 'o' : 'i'})
                    </span>
                  </button>
                );
              })()}

              {sourcesOpen && (
                <>
                  {loadingDetail ? (
                    <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>
                      Verifica impronte e documenti in corso...
                    </div>
                  ) : verifiedSources && verifiedSources.length > 0 ? (
                    verifiedSources.map((s, idx) => {
                      const isModified = s.status === 'modified';
                      const isMissing = s.status === 'missing';
                      const isFresh = s.status === 'fresh';
                      const sourceRef = selectedEntry.sources[idx];
                      const isCited = sourceRef?.cited ?? false;

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            border: isCited
                              ? '1px solid #86efac'
                              : isModified
                              ? '1px solid #fde68a'
                              : isMissing
                              ? '1px solid #fecaca'
                              : '1px solid #e2e8f0',
                            background: isCited
                              ? '#f0fdf4'
                              : isModified
                              ? '#fffbeb'
                              : isMissing
                              ? '#fef2f2'
                              : '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                              <FileText size={14} color={isCited ? '#16a34a' : '#64748b'} />
                              <span style={{ color: isCited ? '#14532d' : '#0f172a' }}>[{s.citationIndex}] {cleanTitle(s.title, s.relativePath)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                              {isFresh && (
                                <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                                  <CheckCircle2 size={13} /> Inalterata
                                </span>
                              )}
                              {isModified && (
                                <span style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <AlertTriangle size={13} /> Modificata
                                </span>
                              )}
                              {isMissing && (
                                <span style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                  <AlertCircle size={13} /> Rimossa
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {formatSourceLabel(s.title, s.relativePath, undefined, s.locator)}
                          </div>

                          {/* Warning banner if modified or missing */}
                          {s.warning && (
                            <div
                              style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                lineHeight: 1.4,
                                background: isModified ? '#fef3c7' : '#fee2e2',
                                color: isModified ? '#92400e' : '#991b1b',
                              }}
                            >
                              ⚠️ {s.warning}
                            </div>
                          )}

                          {/* Display live text if fresh */}
                          {isFresh && s.text && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: 8,
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                                fontSize: 12,
                                color: '#334155',
                                lineHeight: 1.4,
                                maxHeight: 120,
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {s.text}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                      Nessuna fonte salvata per questa risposta.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Back button only: nessuna ripresa di una conversazione dallo storico */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setSelectedEntry(null);
                  setVerifiedSources(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Torna all'elenco
              </button>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            Nessuna domanda salvata per questo Vault.
          </div>
        ) : (
          /* List of Entries Grouped by Conversation */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(() => {
              const map = new Map<string, HistoryEntryHeader[]>();
              for (const entry of entries) {
                const list = map.get(entry.conversationId) || [];
                list.push(entry);
                map.set(entry.conversationId, list);
              }
              const groups: { conversationId: string; latestCreatedAtUtc: string; turns: HistoryEntryHeader[] }[] = [];
              for (const [conversationId, turns] of map.entries()) {
                turns.sort((a, b) => a.turnIndex - b.turnIndex);
                const latest = turns.reduce(
                  (max, t) => (t.createdAtUtc > max ? t.createdAtUtc : max),
                  turns[0].createdAtUtc
                );
                groups.push({ conversationId, latestCreatedAtUtc: latest, turns });
              }
              groups.sort((a, b) => b.latestCreatedAtUtc.localeCompare(a.latestCreatedAtUtc));

              return groups.map(group => {
                const firstPrompt = group.turns[0]?.prompt || 'Conversazione';
                return (
                  <div
                    key={group.conversationId}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 10,
                      background: '#ffffff',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Conversation Group Header */}
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <MessageSquare size={16} color="#0f172a" style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={firstPrompt}
                        >
                          {firstPrompt}
                        </span>
                        <span
                          style={{
                            background: '#e2e8f0',
                            color: '#334155',
                            padding: '1px 6px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {group.turns.length} {group.turns.length === 1 ? 'turno' : 'turni'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                        {formatLocalDate(group.latestCreatedAtUtc)}
                      </span>
                    </div>

                    {/* Turns inside Conversation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
                      {group.turns.map(entry => {
                        const isDeletingThis = entryToDelete === entry.id;

                        return (
                          <div
                            key={entry.id}
                            style={{
                              padding: 10,
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              background: '#fcfcfd',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                  Turno {entry.turnIndex}
                                </span>
                                <span
                                  style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    color: '#0f172a',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                >
                                  {entry.responseModel}
                                </span>
                                {entry.status === 'incomplete' && (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      fontSize: 10,
                                      fontWeight: 600,
                                    }}
                                  >
                                    Incompleta
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  {formatLocalDate(entry.createdAtUtc)}
                                </span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEntryToDelete(entry.id);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    color: '#94a3b8',
                                    display: 'flex',
                                  }}
                                  title="Elimina voce"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Inline Delete Confirmation */}
                            {isDeletingThis ? (
                              <div
                                style={{
                                  padding: 8,
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  fontSize: 12,
                                  color: '#991b1b',
                                }}
                              >
                                <span>Eliminare questo turno dallo storico?</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    onClick={() => setEntryToDelete(null)}
                                    style={{
                                      padding: '3px 8px',
                                      background: '#ffffff',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Annulla
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    disabled={actionInProgress}
                                    style={{
                                      padding: '3px 8px',
                                      background: '#dc2626',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Elimina
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Entry prompt click to open */
                              <div
                                onClick={() => handleSelectEntry(entry)}
                                style={{ cursor: 'pointer' }}
                              >
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    lineHeight: 1.4,
                                    marginBottom: 4,
                                  }}
                                >
                                  {entry.prompt}
                                </div>

                                <div
                                  style={{
                                    fontSize: 12,
                                    color: '#475569',
                                    lineHeight: 1.4,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {entry.answerPreview}
                                </div>

                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: '#2563eb' }}>
                                    {entry.citedSourcesCount ?? 0} citat{(entry.citedSourcesCount ?? 0) === 1 ? 'o' : 'i'} tra {entry.sourcesCount} consultat{entry.sourcesCount === 1 ? 'o' : 'i'}
                                  </span>
                                  <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Footer with Clear Vault History button */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {showClearConfirm ? (
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.4 }}>
              Sei sicuro di voler eliminare tutte le domande e risposte salvate per questo Vault? Nessun documento del Vault verrà toccato. L'operazione non può essere annullata.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '6px 12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleClearHistory}
                disabled={actionInProgress}
                style={{
                  padding: '6px 12px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Svuota storico
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={entries.length === 0}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              color: entries.length === 0 ? '#94a3b8' : '#dc2626',
              fontSize: 13,
              fontWeight: 500,
              cursor: entries.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={14} />
            svuota lo storico di questo vault
          </button>
        )}
      </div>
    </div>
  );
}
