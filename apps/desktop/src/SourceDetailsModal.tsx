import React, { useEffect } from 'react';
import { X, FileText, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import type { AiSource } from './ai-ipc';
import type { CitationOpenRequest } from './vault-ipc';
import { formatSourceLabel, cleanTitle } from './source-utils';

export interface TechnicalDetails {
  durationMs?: number;
  uiTotalMs?: number;
  tokensUsed?: number;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensReasoning?: number;
  model?: string;
  provider?: string;
  status?: string;
  incomplete?: boolean;
  incompleteReason?: string;
  semanticUsed?: boolean;
  semanticFallbackReason?: string;
  rawCitations?: { documentId: string; sha256?: string; relativePath?: string; passageId?: string }[];
}

interface SourceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: AiSource[];
  citations: { documentId: string; relativePath?: string; sha256?: string; passageId?: string }[];
  singleSource?: AiSource | null;
  technicalDetails?: TechnicalDetails | null;
  onOpenDocument?: (req: CitationOpenRequest) => void;
}

export function SourceDetailsModal({
  isOpen,
  onClose,
  sources,
  citations,
  singleSource,
  technicalDetails,
  onOpenDocument,
}: SourceDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCited = (s: AiSource) =>
    Boolean(citations && citations.some(c => c.documentId === s.documentId || c.relativePath === s.relativePath));

  const handleOpenDoc = (s: AiSource) => {
    if (!onOpenDocument) return;
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
  };

  const displayList = singleSource ? [singleSource] : sources;
  const modalTitle = singleSource
    ? cleanTitle(singleSource.title, singleSource.relativePath)
    : `Tutte le fonti consultate (${sources.length})`;

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(2px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <FileText size={20} color="#0f172a" style={{ flexShrink: 0 }} />
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {modalTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Chiudi (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* List of sources */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayList.map((s, idx) => {
              const cited = isCited(s);
              return (
                <div
                  key={`${s.documentId}-${idx}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    backgroundColor: cited ? '#f0fdf4' : '#f8fafc',
                    border: cited ? '1px solid #86efac' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: cited ? '#14532d' : '#0f172a' }}>
                        {formatSourceLabel(s.title, s.relativePath, s.category, s.locator)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        ID: {s.documentId} {s.passageId ? `· Passaggio: ${s.passageId}` : ''}
                      </div>
                    </div>
                    {cited && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: '#22c55e',
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        CITATA
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                    <button
                      onClick={() => handleOpenDoc(s)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Apri documento</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Technical Details (Accordion) */}
          {technicalDetails && (
            <details
              style={{
                marginTop: 8,
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                color: '#475569',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155', userSelect: 'none' }}>
                Dettagli tecnici risposta & tempi
              </summary>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {technicalDetails.provider && (
                  <div><strong>Fornitore:</strong> {technicalDetails.provider}</div>
                )}
                {technicalDetails.model && (
                  <div><strong>Modello:</strong> {technicalDetails.model}</div>
                )}
                {technicalDetails.status && (
                  <div>
                    <strong>Stato:</strong> {technicalDetails.status}
                    {technicalDetails.incomplete ? ` (incompleta: ${technicalDetails.incompleteReason || 'interrotta'})` : ''}
                  </div>
                )}
                {technicalDetails.tokensUsed !== undefined && (
                  <div>
                    <strong>Token:</strong> {technicalDetails.tokensUsed}
                    {(technicalDetails.tokensPrompt !== undefined || technicalDetails.tokensCompletion !== undefined) && (
                      <span> (input: {technicalDetails.tokensPrompt ?? 'N/A'}, output: {technicalDetails.tokensCompletion ?? 'N/A'}{technicalDetails.tokensReasoning !== undefined ? `, ragionamento: ${technicalDetails.tokensReasoning}` : ''})</span>
                    )}
                  </div>
                )}
                {technicalDetails.uiTotalMs && (
                  <div><strong>Tempo totale interfaccia:</strong> {(technicalDetails.uiTotalMs / 1000).toFixed(1)} s ({technicalDetails.uiTotalMs} ms)</div>
                )}
                <div>
                  <strong>Ricerca semantica:</strong>{' '}
                  {technicalDetails.semanticUsed ? (
                    <span style={{ color: '#166534', fontWeight: 600 }}>Attiva (bge-m3 1024d)</span>
                  ) : (
                    <span style={{ color: '#b45309' }}>Non attiva — {technicalDetails.semanticFallbackReason || 'Ripiego su ricerca per parole'}</span>
                  )}
                </div>
                {technicalDetails.rawCitations && technicalDetails.rawCitations.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Citazioni grezze restituite dall'AI:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {technicalDetails.rawCitations.map((c, i) => (
                        <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                          • {c.documentId} {c.sha256 ? `| SHA: ${c.sha256.substring(0, 16)}...` : ''} {c.relativePath ? `| ${c.relativePath}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f8fafc',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
