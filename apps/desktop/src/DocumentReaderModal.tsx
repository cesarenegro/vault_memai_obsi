import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  ExternalLink,
  Folder,
  Copy,
  Check,
  Hash,
  Clock,
  Layers,
  FileCode,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  FileSearch,
} from 'lucide-react';
import type { createVaultIpc, DocumentRecord, DocumentPassage, DocumentVerificationReport } from './vault-ipc';

import { getPlatformTerms } from './platform';

export interface DocumentReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string;
  documentId: string | null;
  initialPassageId?: string | null;
  expectedRevision?: number | null;
  expectedHash?: string | null;
  highlightQuery?: string | null;
  ipc: ReturnType<typeof createVaultIpc>;
}

export function highlightMatches(text: string, query?: string | null): React.ReactNode {
  if (!query || !query.trim()) return text;

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normQuery = normalize(query.trim());
  const normText = normalize(text);

  if (!normText.includes(normQuery)) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let searchIndex = normText.indexOf(normQuery, lastIndex);
  let key = 0;

  while (searchIndex !== -1) {
    if (searchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, searchIndex));
    }
    const matchEnd = searchIndex + query.trim().length;
    parts.push(
      <mark
        key={`hl-${key++}`}
        style={{
          backgroundColor: 'rgba(200, 255, 0, 0.35)',
          color: '#ffffff',
          borderRadius: '3px',
          padding: '1px 3px',
          fontWeight: 600,
        }}
      >
        {text.slice(searchIndex, matchEnd)}
      </mark>
    );
    lastIndex = matchEnd;
    searchIndex = normText.indexOf(normQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  isOpen,
  onClose,
  vaultPath,
  documentId,
  initialPassageId,
  expectedRevision,
  expectedHash,
  highlightQuery,
  ipc,
}) => {
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'passages' | 'fulltext' | 'metadata'>('passages');
  const [fullText, setFullText] = useState<string | null>(null);
  const [copiedLocator, setCopiedLocator] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [verificationReport, setVerificationReport] = useState<DocumentVerificationReport | null>(null);
  const passageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load document and passages whenever documentId changes
  useEffect(() => {
    if (!isOpen || !documentId) {
      setDoc(null);
      setFullText(null);
      setError(null);
      setVerificationReport(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setActionMessage(null);
    setVerificationReport(null);

    (async () => {
      try {
        let record: DocumentRecord;
        if (documentId.startsWith('doc_')) {
          record = await ipc.getCatalogDocument(vaultPath, documentId);
        } else {
          // Direct unpaged lookup by canonical path or alias (R5: eliminates 50-document limit)
          const cleanPath = documentId.split('#')[0];
          record = await ipc.getCatalogDocumentByPath(vaultPath, cleanPath);
        }
        if (!active) return;
        setDoc(record);

        // Verify document, revision, and passage integrity (R4)
        try {
          const report = await ipc.verifyDocumentPassage(
            vaultPath,
            record.documentId,
            initialPassageId || undefined,
            expectedHash || undefined,
            expectedRevision != null ? expectedRevision : undefined
          );
          if (active) setVerificationReport(report);
        } catch (vErr) {
          console.warn('Verification check failed:', vErr);
        }

        // Load verified text (R4)
        try {
          const txt = await ipc.readVerifiedDocumentText(vaultPath, record.documentId, expectedRevision != null ? expectedRevision : undefined);
          if (active) setFullText(txt);
        } catch {
          try {
            const fallbackTxt = await ipc.readDocumentText(vaultPath, record.documentId);
            if (active) setFullText(fallbackTxt);
          } catch {
            if (active) setFullText(null);
          }
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, documentId, vaultPath, ipc, initialPassageId, expectedRevision, expectedHash]);

  // Scroll to initial passage when rendered
  useEffect(() => {
    if (initialPassageId && activeTab === 'passages' && doc) {
      const el = passageRefs.current.get(initialPassageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = '#c8ff00';
        setTimeout(() => {
          if (el) el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }, 2500);
      }
    }
  }, [initialPassageId, activeTab, doc]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenOriginal = async () => {
    if (!documentId) return;
    try {
      await ipc.openOriginal(vaultPath, documentId);
      setActionMessage('Documento aperto nell’applicazione di sistema.');
    } catch (err) {
      setActionMessage(`Errore apertura: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const terms = getPlatformTerms();

  const handleRevealInFinder = async () => {
    if (!documentId) return;
    try {
      await ipc.revealInFinder(vaultPath, documentId);
      setActionMessage(`File evidenziato in ${terms.fileManager}.`);
    } catch (err) {
      setActionMessage(`Errore ${terms.fileManager}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCopyCitation = (passage: DocumentPassage) => {
    if (!doc) return;
    const citation = `[[${doc.originalPath}#${passage.locator}]]`;
    navigator.clipboard.writeText(citation);
    setCopiedLocator(passage.passageId);
    setTimeout(() => setCopiedLocator(null), 2000);
  };

  const handleCopyHash = () => {
    if (!doc) return;
    navigator.clipboard.writeText(doc.contentHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'xlsx':
      case 'xls':
      case 'csv':
      case 'ods':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'pdf':
        return <FileSearch className="w-5 h-5 text-red-400" />;
      case 'docx':
      case 'doc':
      case 'odt':
      case 'pptx':
        return <FileText className="w-5 h-5 text-blue-400" />;
      default:
        return <FileCode className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Estratto e indicizzato
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            In elaborazione...
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            In coda di estrazione
          </span>
        );
      case 'protected':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Protetto da password
          </span>
        );
      case 'unsupported':
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">
            Formato non supportato
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
            Estrazione non riuscita
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#14171c] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#191d24]">
          <div className="flex items-center space-x-3 min-w-0 pr-4">
            {doc ? getFormatIcon(doc.extension) : <FileText className="w-5 h-5 text-zinc-400" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="reader-modal-title"
                  className="text-base font-semibold text-white truncate max-w-lg"
                  title={doc?.fileName || 'Lettore Documento'}
                >
                  {doc?.fileName || 'Lettore Documento'}
                </h2>
                {verificationReport && (
                  verificationReport.isValid ? (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3" /> Verificato SHA-256 (rev. {verificationReport.currentRevision})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3 text-red-400" /> Integrità non conforme
                    </span>
                  )
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-xl">{doc?.originalPath || documentId}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleOpenOriginal}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 flex items-center space-x-1.5 transition-colors"
              title="Apri con l'applicazione di sistema predefinita"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Apri originale</span>
            </button>
            <button
              onClick={handleRevealInFinder}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 flex items-center space-x-1.5 transition-colors"
              title={`Mostra in ${terms.fileManager}`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Mostra in {terms.fileManager}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Chiudi lettore"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Verification alert banner if invalid */}
        {verificationReport && !verificationReport.isValid && (
          <div className="px-6 py-3 bg-red-500/15 border-b border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <div className="font-semibold text-red-300">
                {verificationReport.status === 'revision_mismatch'
                  ? 'REVISIONE AGGIORNATA RISPETTO ALLA RISPOSTA'
                  : verificationReport.status === 'tampered_original'
                  ? 'FILE ORIGINALE MODIFICATO SU DISCO DOPO L’INGESTION'
                  : verificationReport.status === 'tampered_passage'
                  ? 'INTEGRITÀ PASSAGGIO COMPROMESSA'
                  : verificationReport.status === 'missing_original'
                  ? 'FILE ORIGINALE NON TROVATO SU DISCO'
                  : 'INTEGRITÀ NON CONFORME'}
              </div>
              <div className="text-red-200/90">{verificationReport.message}</div>
            </div>
          </div>
        )}

        {/* Action feedback bar */}
        {actionMessage && (
          <div className="px-6 py-2 bg-[#c8ff00]/10 border-b border-[#c8ff00]/20 text-xs text-[#c8ff00] flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        {doc && (
          <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-[#171a20]">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('passages')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'passages'
                    ? 'bg-[#c8ff00] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Passaggi ({doc.passages.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('fulltext')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'fulltext'
                    ? 'bg-[#c8ff00] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Testo Integrale</span>
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'metadata'
                    ? 'bg-[#c8ff00] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Metadati e Provenienza</span>
              </button>
            </div>

            <div className="flex items-center space-x-3 text-xs text-zinc-400">
              {getStatusBadge(doc.extractionStatus)}
              <span>{formatBytes(doc.fileSize)}</span>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#c8ff00]" />
              <p className="text-sm">Caricamento documento e passaggi estratti...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <h3 className="text-base font-semibold text-white">Documento non trovato o non disponibile</h3>
              <p className="text-sm text-zinc-400 max-w-md">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                Chiudi
              </button>
            </div>
          ) : !doc ? (
            <div className="py-20 text-center text-zinc-500">Nessun dato disponibile.</div>
          ) : activeTab === 'passages' ? (
            <div className="space-y-4">
              {doc.passages.length === 0 ? (
                <div className="py-16 text-center text-zinc-400 border border-dashed border-white/10 rounded-xl p-8">
                  <FileText className="w-8 h-8 mx-auto mb-3 text-zinc-500" />
                  <p className="text-sm font-medium text-zinc-300">Nessun passaggio estratto per questo documento.</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {doc.extractionStatus === 'protected'
                      ? 'Il file è protetto da password o crittografato.'
                      : doc.extractionStatus === 'unsupported'
                      ? 'Il formato del file non supporta l’estrazione di testo.'
                      : 'È possibile aprire il file originale tramite l’azione "Apri originale".'}
                  </p>
                </div>
              ) : (
                doc.passages.map((passage, index) => {
                  const isInitial = passage.passageId === initialPassageId || (!!passage.locator && passage.locator === initialPassageId);
                  return (
                    <div
                      key={passage.passageId}
                      ref={(el) => {
                        if (el) {
                          passageRefs.current.set(passage.passageId, el);
                          if (passage.locator) passageRefs.current.set(passage.locator, el);
                        } else {
                          passageRefs.current.delete(passage.passageId);
                          if (passage.locator) passageRefs.current.delete(passage.locator);
                        }
                      }}
                      className={`p-4 rounded-xl border transition-all ${
                        isInitial
                          ? 'bg-[#1e232c] border-[#c8ff00] shadow-lg shadow-[#c8ff00]/5'
                          : 'bg-[#181b22] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#c8ff00]/10 text-[#c8ff00] border border-[#c8ff00]/20">
                            {passage.locator || `Passaggio ${index + 1}`}
                          </span>
                          <span className="text-xs text-zinc-500">{passage.charCount} caratteri</span>
                        </div>
                        <button
                          onClick={() => handleCopyCitation(passage)}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white rounded hover:bg-white/5 flex items-center space-x-1 transition-colors"
                          title="Copia riferimento [[file#locator]]"
                        >
                          {copiedLocator === passage.passageId ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiato!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copia citazione</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {highlightMatches(passage.text, highlightQuery)}
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>SHA-256: {passage.sha256.slice(0, 16)}…</span>
                        <span>ID: {passage.passageId}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'fulltext' ? (
            <div className="bg-[#181b22] p-6 rounded-xl border border-white/5">
              {fullText ? (
                <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {highlightMatches(fullText, highlightQuery)}
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  Testo integrale non disponibile per questo file.
                </div>
              )}
            </div>
          ) : (
            /* Metadata Tab */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#181b22] p-5 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">File e Provenienza</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Nome file:</span>
                    <span className="text-zinc-200 font-medium">{doc.fileName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Percorso nel Vault:</span>
                    <span className="text-zinc-200 font-mono">{doc.originalPath}</span>
                  </div>
                  {doc.aliases.length > 0 && (
                    <div>
                      <span className="text-zinc-500 block">Alias duplicati ({doc.aliases.length}):</span>
                      <ul className="text-zinc-400 list-disc list-inside font-mono text-[11px] mt-1 space-y-0.5">
                        {doc.aliases.map((alias, i) => (
                          <li key={i}>{alias}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500 block">Dimensione:</span>
                    <span className="text-zinc-200">{formatBytes(doc.fileSize)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Tipo MIME:</span>
                    <span className="text-zinc-200">{doc.mimeType}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#181b22] p-5 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Integrità e Revisione</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Document ID:</span>
                    <span className="text-zinc-200 font-mono">{doc.documentId}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Revisione:</span>
                    <span className="text-zinc-200 font-semibold">{doc.revision}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Hash SHA-256:</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-zinc-200 font-mono text-[11px] truncate">{doc.contentHash}</span>
                      <button
                        onClick={handleCopyHash}
                        className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/5 shrink-0"
                        title="Copia hash SHA-256 completo"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Acquisito il:</span>
                    <span className="text-zinc-300 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{new Date(doc.importedAt).toLocaleString('it-IT')}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Ultimo aggiornamento:</span>
                    <span className="text-zinc-300">{new Date(doc.updatedAt).toLocaleString('it-IT')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#181b22] p-5 rounded-xl border border-white/5 space-y-3 md:col-span-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stato Fasi di Elaborazione</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-zinc-500 block text-[11px]">Estrazione Testo</span>
                    <span className="text-zinc-200 font-medium capitalize mt-1 block">
                      {doc.extractionStatus}
                    </span>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-zinc-500 block text-[11px]">Indice Lessicale</span>
                    <span className="text-zinc-200 font-medium capitalize mt-1 block">
                      {doc.lexicalStatus.status}
                    </span>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-zinc-500 block text-[11px]">Indice Semantico</span>
                    <span className="text-zinc-200 font-medium capitalize mt-1 block">
                      {doc.semanticStatus.status}
                    </span>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-zinc-500 block text-[11px]">Classificazione</span>
                    <span className="text-zinc-200 font-medium capitalize mt-1 block">
                      {doc.classificationStatus.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#191d24] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span>Navigazione rapida:</span>
            <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-300 text-[10px]">ESC</kbd>
            <span>per chiudere</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
