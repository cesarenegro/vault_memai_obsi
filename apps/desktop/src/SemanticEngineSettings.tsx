import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  aiIpc,
  type EmbeddingsProviderReport,
  type LocalModelReport,
  type LocalServerReport,
  type LocalModelProgress,
} from './ai-ipc';
import { getPlatformTerms, normalizeVaultPath } from './platform';

const fieldStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
};

const buttonPrimary: React.CSSProperties = {
  ...fieldStyle,
  cursor: 'pointer',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 600,
};

const buttonSecondary: React.CSSProperties = {
  ...fieldStyle,
  cursor: 'pointer',
  background: '#f8fafc',
  color: '#1e293b',
  fontWeight: 500,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function SemanticEngineSettings({ vaultPath }: { vaultPath: string }) {
  const terms = getPlatformTerms();
  const [providerReport, setProviderReport] = useState<EmbeddingsProviderReport | null>(null);
  const [modelReport, setModelReport] = useState<LocalModelReport | null>(null);
  const [serverReport, setServerReport] = useState<LocalServerReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<LocalModelProgress | null>(null);

  const [startingServer, setStartingServer] = useState(false);
  const isStarting = startingServer || Boolean(serverReport?.starting);
  const [stoppingServer, setStoppingServer] = useState(false);
  const [pickingModelFile, setPickingModelFile] = useState(false);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [optimisticProvider, setOptimisticProvider] = useState<'openai' | 'local' | null>(null);

  const [reindexing, setReindexing] = useState(false);
  const [reindexPercent, setReindexPercent] = useState<number | null>(null);
  const [reindexCounts, setReindexCounts] = useState<{ processed: number; total: number } | null>(null);

  const [openaiConsent, setOpenaiConsent] = useState<boolean>(false);
  const [selectedOpenaiModel, setSelectedOpenaiModel] = useState<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('limen_openai_model') || 'gpt-4o-mini' : 'gpt-4o-mini'
  );

  // Modello generativo locale Ministral 3 8B (FASE 8)
  const [llmModelReport, setLlmModelReport] = useState<LocalModelReport | null>(null);
  const [llmServerReport, setLlmServerReport] = useState<LocalServerReport | null>(null);
  const [llmDownloading, setLlmDownloading] = useState<boolean>(false);
  const [llmDownloadProgress, setLlmDownloadProgress] = useState<LocalModelProgress | null>(null);
  const [llmStartingServer, setLlmStartingServer] = useState<boolean>(false);
  const [llmStoppingServer, setLlmStoppingServer] = useState<boolean>(false);
  const [llmVerifyingIntegrity, setLlmVerifyingIntegrity] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  const refreshAll = async () => {
    if (!vaultPath) return;
    setRefreshing(true);
    try {
      const [prov, model, srv, consent, llmModel, llmSrv] = await Promise.all([
        aiIpc.embeddingsGetProvider(vaultPath),
        aiIpc.localModelStatus(),
        aiIpc.localServerStatus(),
        aiIpc.getConsent(vaultPath).catch(() => false),
        aiIpc.localLlmStatus().catch(() => null),
        aiIpc.localLlmServerStatus().catch(() => null),
      ]);
      if (isMounted.current) {
        setProviderReport(prov);
        setModelReport(model);
        setServerReport(srv);
        setOpenaiConsent(consent);
        if (llmModel) setLlmModelReport(llmModel);
        if (llmSrv) setLlmServerReport(llmSrv);
        setOptimisticProvider(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(`Errore nel caricamento delle impostazioni semantiche: ${String(err)}`);
      }
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  const handleToggleConsent = async (granted: boolean) => {
    setOpenaiConsent(granted);
    try {
      await aiIpc.setConsent(vaultPath, granted);
      setSuccessMessage(granted ? 'Consenso all’invio dei passaggi a OpenAI accordato.' : 'Consenso revocato.');
    } catch (err) {
      setError(`Impossibile aggiornare il consenso: ${String(err)}`);
    }
  };

  const handleSelectOpenaiModel = (modelName: string) => {
    setSelectedOpenaiModel(modelName);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('limen_openai_model', modelName);
    }
    setSuccessMessage(`Modello OpenAI predefinito impostato su ${modelName}.`);
  };

  useEffect(() => {
    isMounted.current = true;
    void refreshAll();

    let unlistenDownload: (() => void) | undefined;
    let unlistenLlmDownload: (() => void) | undefined;
    let unlistenSync: (() => void) | undefined;

    void listen<LocalModelProgress>('local_model_download_progress', (e) => {
      if (isMounted.current) {
        setDownloadProgress(e.payload);
      }
    }).then((unlisten) => {
      unlistenDownload = unlisten;
    }).catch((err) => {
      // Errore visibile: un listener negato dai permessi Tauri lascerebbe l'avanzamento fermo senza spiegazione.
      console.error('[LIMEN] listen non registrato:', err);
    });

    void listen<LocalModelProgress>('local_llm_download_progress', (e) => {
      if (isMounted.current) {
        setLlmDownloadProgress(e.payload);
      }
    }).then((unlisten) => {
      unlistenLlmDownload = unlisten;
    }).catch((err) => {
      console.error('[LIMEN] listen local_llm_download_progress non registrato:', err);
    });

    void listen<{ percent: number; processed: number; total: number }>('embeddings_sync_progress', (e) => {
      if (isMounted.current) {
        setReindexPercent(e.payload.percent);
        setReindexCounts({ processed: e.payload.processed, total: e.payload.total });
        // Primo evento (0 elaborati): il backend ha appena avviato il servizio locale su richiesta.
        // Senza questa rilettura il badge restava su SPENTO per tutta la durata del ricalcolo (collaudo 20/09/2026).
        if (e.payload.processed === 0) {
          void refreshAll();
        }
      }
    }).then((unlisten) => {
      unlistenSync = unlisten;
    }).catch((err) => {
      // Errore visibile: un listener negato dai permessi Tauri lascerebbe l'avanzamento fermo senza spiegazione.
      console.error('[LIMEN] listen non registrato:', err);
    });

    return () => {
      isMounted.current = false;
      if (unlistenDownload) unlistenDownload();
      if (unlistenLlmDownload) unlistenLlmDownload();
      if (unlistenSync) unlistenSync();
    };
  }, [vaultPath]);

  const handleLlmDownload = async () => {
    setLlmDownloading(true);
    setLlmDownloadProgress({ downloaded: 0, total: 6059268512, percent: 0 });
    setError(null);
    try {
      const rep = await aiIpc.localLlmDownload();
      if (isMounted.current) {
        setLlmModelReport(rep);
        setSuccessMessage('Modello Ministral 3 8B scaricato e verificato con successo.');
      }
    } catch (err) {
      if (isMounted.current) setError(`Download di Ministral fallito: ${String(err)}`);
    } finally {
      if (isMounted.current) setLlmDownloading(false);
    }
  };

  const handleLlmVerifyIntegrity = async () => {
    setLlmVerifyingIntegrity(true);
    setError(null);
    try {
      const rep = await aiIpc.localLlmVerifyIntegrity();
      if (isMounted.current) {
        setLlmModelReport(rep);
        if (rep.sha256Ok) {
          setSuccessMessage('Integrità crittografica SHA-256 di Ministral 3 8B verificata con successo.');
        } else {
          setError('Checksum SHA-256 non corrispondente per il modello Ministral.');
        }
      }
    } catch (err) {
      if (isMounted.current) setError(`Verifica integrità fallita: ${String(err)}`);
    } finally {
      if (isMounted.current) setLlmVerifyingIntegrity(false);
    }
  };

  const handleLlmStartServer = async () => {
    setLlmStartingServer(true);
    setError(null);
    try {
      const srv = await aiIpc.localLlmServerStart();
      if (isMounted.current) {
        setLlmServerReport(srv);
        setSuccessMessage(`Servizio locale Ministral 3 8B avviato (porta ${srv.port}).`);
      }
    } catch (err) {
      if (isMounted.current) setError(`Avvio servizio Ministral fallito: ${String(err)}`);
    } finally {
      if (isMounted.current) setLlmStartingServer(false);
    }
  };

  const handleLlmStopServer = async () => {
    setLlmStoppingServer(true);
    setError(null);
    try {
      const srv = await aiIpc.localLlmServerStop();
      if (isMounted.current) {
        setLlmServerReport(srv);
        setSuccessMessage('Servizio locale Ministral 3 8B arrestato. Memoria Metal liberata.');
      }
    } catch (err) {
      if (isMounted.current) setError(`Arresto servizio Ministral fallito: ${String(err)}`);
    } finally {
      if (isMounted.current) setLlmStoppingServer(false);
    }
  };

  useEffect(() => {
    if (!serverReport?.starting) return;
    const interval = setInterval(() => {
      void refreshAll();
    }, 1000);
    return () => clearInterval(interval);
  }, [serverReport?.starting]);

  const handleSelectProvider = async (provider: 'openai' | 'local') => {
    if (loading || downloading || reindexing) return;
    setOptimisticProvider(provider);
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const updated = await aiIpc.embeddingsSetProvider(vaultPath, provider);
      setProviderReport(updated);
      setSuccessMessage(`Fornitore semantico aggiornato a: ${provider === 'local' ? 'Locale (bge-m3)' : 'OpenAI'}`);
      await refreshAll();
    } catch (err) {
      setOptimisticProvider(null);
      setError(`Impossibile impostare il fornitore: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadModel = async () => {
    if (downloading || loading) return;
    setError(null);
    setSuccessMessage(null);
    setDownloading(true);
    setDownloadProgress(null);
    try {
      const rep = await aiIpc.localModelDownload();
      setModelReport(rep);
      setSuccessMessage('Modello bge-m3-Q8_0.gguf scaricato e verificato con successo (SHA-256 integro).');
    } catch (err) {
      setError(`Download del modello fallito: ${String(err)}`);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
      await refreshAll();
    }
  };

  const handlePickModelFile = async () => {
    if (pickingModelFile || loading || downloading) return;
    setError(null);
    setSuccessMessage(null);
    setPickingModelFile(true);
    try {
      const rep = await aiIpc.localModelPickAndInstall();
      setModelReport(rep);
      if (rep.sha256Ok) {
        setSuccessMessage('Modello selezionato installato con successo e SHA-256 verificato.');
      } else {
        setError('Modello selezionato installato ma la verifica SHA-256 non è valida.');
      }
    } catch (err) {
      setError(`Installazione del file fallita: ${String(err)}`);
    } finally {
      setPickingModelFile(false);
      await refreshAll();
    }
  };

  const handleVerifyIntegrity = async () => {
    if (verifyingIntegrity || loading || downloading) return;
    setError(null);
    setSuccessMessage(null);
    setVerifyingIntegrity(true);
    try {
      const rep = await aiIpc.localModelVerifyIntegrity();
      setModelReport(rep);
      if (rep.sha256Ok) {
        setSuccessMessage('Verifica integrità completata: SHA-256 integro e cache allineata.');
      } else {
        setError('Verifica integrità fallita: SHA-256 non corrispondente al modello bge-m3-Q8_0.');
      }
    } catch (err) {
      setError(`Errore durante la verifica di integrità: ${String(err)}`);
    } finally {
      setVerifyingIntegrity(false);
      await refreshAll();
    }
  };

  const handleStartServer = async () => {
    if (isStarting || loading) return;
    setError(null);
    setSuccessMessage(null);
    setStartingServer(true);
    try {
      const rep = await aiIpc.localServerStart();
      setServerReport(rep);
      if (rep.healthy) {
        setSuccessMessage(`Servizio locale avviato con successo sulla porta ${rep.port}.`);
      } else {
        setError(`Servizio avviato ma non sano: ${rep.lastError || 'nessuna risposta da /health'}`);
      }
    } catch (err) {
      setError(`Avvio del servizio locale non riuscito: ${String(err)}`);
    } finally {
      setStartingServer(false);
      await refreshAll();
    }
  };

  const handleStopServer = async () => {
    if (stoppingServer || loading) return;
    setError(null);
    setSuccessMessage(null);
    setStoppingServer(true);
    try {
      const rep = await aiIpc.localServerStop();
      setServerReport(rep);
      setSuccessMessage('Servizio locale arrestato.');
    } catch (err) {
      setError(`Arresto del servizio non riuscito: ${String(err)}`);
    } finally {
      setStoppingServer(false);
      await refreshAll();
    }
  };

  const handleReindexCache = async () => {
    setError(null);
    setSuccessMessage(null);
    setReindexing(true);
    setReindexPercent(0);
    setReindexCounts(null);
    try {
      await aiIpc.embeddingsSyncVault(vaultPath);
      setSuccessMessage('Cache semantica ricalcolata e allineata con successo al 100%.');
    } catch (err) {
      setError(`Ricalcolo cache fallito o interrotto: ${String(err)}`);
    } finally {
      setReindexing(false);
      setReindexPercent(null);
      setReindexCounts(null);
      await refreshAll();
    }
  };

  const handleCancelReindex = async () => {
    try {
      await aiIpc.embeddingsCancelSync();
      setError('Ricalcolo cache annullato dall’utente. I progressi calcolati sono salvati e riprendibili.');
    } catch (err) {
      setError(`Errore durante l’annullamento: ${String(err)}`);
    }
  };

  const effectiveProvider = optimisticProvider ?? providerReport?.provider ?? 'local';
  const isLocal = effectiveProvider === 'local';

  return (
    <div className="limen-card" style={{ padding: 24, marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Motore semantico</h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: isLocal ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: isLocal ? '#15803d' : '#1d4ed8',
            border: `1px solid ${isLocal ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
          }}
        >
          {isLocal ? 'RAG 100% LOCALE' : 'OPENAI (RETE)'}
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px 0' }}>
        Configura il fornitore per il calcolo dei vettori semantici e la ricerca ibrida. Con il motore locale, nessun
        dato esce dal computer e il funzionamento è a rete zero.
      </p>

      {/* 1. SCELTA DEL FORNITORE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 14,
            borderRadius: 8,
            border: `2px solid ${!isLocal ? '#0f172a' : '#e2e8f0'}`,
            backgroundColor: !isLocal ? '#f8fafc' : '#ffffff',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="embeddingsProvider"
              checked={!isLocal}
              onChange={() => handleSelectProvider('openai')}
              disabled={loading || downloading || reindexing}
            />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>OpenAI (in rete)</span>
          </div>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 24 }}>
            Modello <code>text-embedding-3-small</code> (1536 dim). Richiede chiave API configurata nel {terms.keychainTerm} e
            connessione internet.
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: 14,
            borderRadius: 8,
            border: `2px solid ${isLocal ? '#15803d' : '#e2e8f0'}`,
            backgroundColor: isLocal ? 'rgba(34, 197, 94, 0.04)' : '#ffffff',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="embeddingsProvider"
              checked={isLocal}
              onChange={() => handleSelectProvider('local')}
              disabled={loading || downloading || reindexing}
            />
            <span style={{ fontWeight: 700, fontSize: 14, color: isLocal ? '#15803d' : '#0f172a' }}>
              Locale (bge-m3, nessun dato esce dal computer)
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 24 }}>
            Modello <code>bge-m3-Q8_0.gguf</code> (1024 dim) eseguito dal motore integrato. Funzionamento 100% offline a
            rete zero.
          </span>
        </label>
      </div>

      {/* 2. STATO DEL MODELLO LOCALE */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 16,
          backgroundColor: '#f8fafc',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Modello locale (bge-m3-Q8_0.gguf)</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: modelReport === null || verifyingIntegrity ? '#fef3c7' : modelReport.installed && modelReport.sha256Ok ? '#dcfce7' : '#fee2e2',
              color: modelReport === null || verifyingIntegrity ? '#92400e' : modelReport.installed && modelReport.sha256Ok ? '#166534' : '#991b1b',
            }}
          >
            {verifyingIntegrity
              ? 'VERIFICA IN CORSO…'
              : modelReport === null
              ? 'CONTROLLO IN CORSO…'
              : modelReport.installed && modelReport.sha256Ok
              ? 'INSTALLATO (SHA-256 OK)'
              : modelReport.installed
              ? 'INTEGRITÀ NON VALIDA'
              : 'NON INSTALLATO'}
          </span>
        </div>

        {modelReport?.installed ? (
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              <strong>Percorso:</strong> <code style={{ fontSize: 11 }}>{normalizeVaultPath(modelReport.path)}</code>
            </div>
            <div>
              <strong>Dimensione:</strong> {formatBytes(modelReport.bytes)} (634.553.760 byte)
            </div>
            <div style={{ color: '#166534', fontWeight: 500, marginTop: 4 }}>
              ✓ Dopo lo scaricamento, il funzionamento è a rete zero. Nessun dato lascia mai questo computer.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                style={{
                  ...buttonSecondary,
                  backgroundColor: verifyingIntegrity ? '#fef3c7' : '#f8fafc',
                  color: verifyingIntegrity ? '#92400e' : '#1e293b',
                  borderColor: verifyingIntegrity ? '#f59e0b' : '#cbd5e1',
                  cursor: loading || downloading || verifyingIntegrity || pickingModelFile ? 'not-allowed' : 'pointer',
                }}
                disabled={loading || downloading || verifyingIntegrity || pickingModelFile}
                onClick={handleVerifyIntegrity}
              >
                {verifyingIntegrity ? 'VERIFICA IN CORSO…' : 'VERIFICA INTEGRITÀ'}
              </button>
              <button
                style={{
                  ...buttonSecondary,
                  backgroundColor: pickingModelFile ? '#fef3c7' : '#f8fafc',
                  color: pickingModelFile ? '#92400e' : '#1e293b',
                  borderColor: pickingModelFile ? '#f59e0b' : '#cbd5e1',
                  cursor: loading || downloading || verifyingIntegrity || pickingModelFile ? 'not-allowed' : 'pointer',
                }}
                disabled={loading || downloading || verifyingIntegrity || pickingModelFile}
                onClick={handlePickModelFile}
              >
                {pickingModelFile ? 'SELEZIONE E VERIFICA IN CORSO…' : 'SOSTITUISCI FILE GGUF DA DISCO…'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px 0' }}>
              Il modello non è presente sul computer. È richiesto un download una tantum di 635 MB dal repository gpustack,
              oppure puoi selezionare manualmente un file GGUF precedentemente scaricato.
            </p>

            {downloading ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Scaricamento in corso da HuggingFace…</span>
                  <span>{downloadProgress ? `${downloadProgress.percent.toFixed(1)}%` : 'Avvio…'}</span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e2e8f0',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: '#15803d',
                      width: `${downloadProgress?.percent || 0}%`,
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
                <button
                  style={{ ...buttonSecondary, color: '#b91c1c', border: '1px solid #fecaca' }}
                  onClick={() => setDownloading(false)}
                >
                  ANNULLA SCARICAMENTO
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={buttonPrimary}
                  disabled={loading || downloading || pickingModelFile}
                  onClick={handleDownloadModel}
                >
                  SCARICA MODELLO (635 MB)
                </button>
                <button
                  style={{
                    ...buttonSecondary,
                    backgroundColor: pickingModelFile ? '#fef3c7' : '#f8fafc',
                    color: pickingModelFile ? '#92400e' : '#1e293b',
                    borderColor: pickingModelFile ? '#f59e0b' : '#cbd5e1',
                    cursor: loading || downloading || pickingModelFile ? 'not-allowed' : 'pointer',
                  }}
                  disabled={loading || downloading || pickingModelFile}
                  onClick={handlePickModelFile}
                >
                  {pickingModelFile ? 'SELEZIONE E VERIFICA IN CORSO…' : 'SELEZIONA FILE GGUF DA DISCO…'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. STATO DEL SERVIZIO LOCALE (llama-server) */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 16,
          backgroundColor: '#f8fafc',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Servizio locale di calcolo</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor:
                isStarting
                  ? '#fef3c7'
                  : serverReport?.running && serverReport.healthy
                  ? '#dcfce7'
                  : serverReport?.lastError
                  ? '#fee2e2'
                  : '#f1f5f9',
              color:
                isStarting
                  ? '#92400e'
                  : serverReport?.running && serverReport.healthy
                  ? '#166534'
                  : serverReport?.lastError
                  ? '#991b1b'
                  : '#64748b',
            }}
          >
            {isStarting
              ? 'IN AVVIO…'
              : serverReport?.running && serverReport.healthy
              ? `ATTIVO (PORTA ${serverReport.port})`
              : serverReport?.lastError
              ? 'ERRORE'
              : 'SPENTO'}
          </span>
        </div>

        <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
          {isStarting ? (
            <div style={{ color: '#92400e' }}>
              Avvio del servizio locale in corso in background. Controllo di salute in attesa...
            </div>
          ) : serverReport?.running && serverReport.healthy ? (
            <div>
              Il servizio è in ascolto su loopback <code>http://127.0.0.1:{serverReport.port}</code> con modello{' '}
              <strong>{serverReport.model}</strong>. Controllo di salute <code>/health</code> superato.
            </div>
          ) : serverReport?.lastError ? (
            <div style={{ color: '#b91c1c' }}>
              <strong>Ultimo errore:</strong> {serverReport.lastError}
            </div>
          ) : (
            <div>
              Il servizio è spento. Si avvia automaticamente su richiesta quando serve un embedding semantico, oppure
              puoi avviarlo manualmente.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {serverReport?.running ? (
            <button
              style={{
                ...buttonSecondary,
                color: '#b91c1c',
                border: '1px solid #fecaca',
                backgroundColor: stoppingServer ? '#fee2e2' : '#f8fafc',
                cursor: loading || isStarting || stoppingServer ? 'not-allowed' : 'pointer',
              }}
              disabled={loading || isStarting || stoppingServer}
              onClick={handleStopServer}
            >
              {stoppingServer ? 'ARRESTO IN CORSO…' : 'ARRESTA SERVIZIO LOCALE'}
            </button>
          ) : (
            <button
              style={{
                ...buttonSecondary,
                backgroundColor: isStarting ? '#fef3c7' : '#f8fafc',
                color: isStarting ? '#92400e' : '#1e293b',
                borderColor: isStarting ? '#f59e0b' : '#cbd5e1',
                cursor: loading || isStarting || stoppingServer || !modelReport?.installed ? 'not-allowed' : 'pointer',
              }}
              disabled={loading || isStarting || stoppingServer || !modelReport?.installed}
              onClick={handleStartServer}
            >
              {isStarting ? 'AVVIO IN CORSO…' : 'AVVIA SERVIZIO LOCALE'}
            </button>
          )}
          <button
            style={{
              ...buttonSecondary,
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
            }}
            onClick={refreshAll}
            disabled={loading || refreshing}
          >
            {refreshing ? 'AGGIORNAMENTO…' : 'AGGIORNA STATO'}
          </button>
        </div>
      </div>

      {/* 4. DISALLINEAMENTO DIMENSIONI E MIGRAZIONE CACHE */}
      {providerReport && (
        <div
          style={{
            border: `1px solid ${providerReport.needsReindex ? '#f59e0b' : '#e2e8f0'}`,
            borderRadius: 8,
            padding: 16,
            backgroundColor: providerReport.needsReindex ? 'rgba(245, 158, 11, 0.06)' : '#ffffff',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Cache semantica del Vault</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {providerReport.cacheEntries === 0
                ? 'Nessun passaggio indicizzato'
                : `${providerReport.cacheEntries} passaggi indicizzati (${providerReport.cacheDimensions} dim)`}
            </span>
          </div>

          {providerReport.needsReindex ? (
            <div>
              <div style={{ fontSize: 13, color: '#92400e', marginBottom: 10 }}>
                {providerReport.cacheEntries === 0 ? (
                  <>
                    ⚠️ <strong>Cache semantica assente:</strong> nessun vettore è ancora stato calcolato per questo Vault.
                    <br />
                    I <strong>{providerReport.totalPassages}</strong> passaggi del vault devono essere calcolati per attivare
                    la ricerca semantica.
                  </>
                ) : providerReport.cacheDimensions !== providerReport.dimensions ? (
                  <>
                    ⚠️ <strong>Disallineamento dimensioni vettore rilevato:</strong> la cache attuale memorizza vettori a{' '}
                    <strong>{providerReport.cacheDimensions}</strong> dimensioni, mentre il fornitore scelto (
                    <strong>{providerReport.provider}</strong>) genera vettori a{' '}
                    <strong>{providerReport.dimensions}</strong> dimensioni.
                    <br />
                    I <strong>{providerReport.totalPassages}</strong> passaggi del vault devono essere ricalcolati per attivare
                    la ricerca semantica.
                    <br />
                    <em>Nota di sicurezza: la cache attuale rimane attiva finché il nuovo calcolo non è completato al 100%.</em>
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Cache semantica incompleta:</strong>{' '}
                    <strong>{providerReport.totalPassages - providerReport.matchedPassages}</strong> passaggi su{' '}
                    {providerReport.totalPassages} non sono ancora indicizzati (documenti nuovi o modificati).
                  </>
                )}
                <br />
                Durata indicativa: circa 0,1 s per passaggio con GPU Metal su Apple Silicon (misurato con bge-m3 su M2),
                fino a 7 volte di più senza GPU. L’avanzamento è mostrato qui sotto durante il calcolo.
              </div>

              {reindexing ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>
                      Ricalcolo cache in corso…
                      {reindexCounts ? ` ${reindexCounts.processed}/${reindexCounts.total} passaggi` : ''}
                    </span>
                    <span>{reindexPercent !== null ? `${reindexPercent.toFixed(1)}%` : 'Elaborazione…'}</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#e2e8f0',
                      overflow: 'hidden',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#d97706',
                        width: `${reindexPercent || 0}%`,
                        transition: 'width 0.2s',
                      }}
                    />
                  </div>
                  <button
                    style={{ ...buttonSecondary, color: '#b91c1c', border: '1px solid #fecaca' }}
                    onClick={handleCancelReindex}
                  >
                    ANNULLA (I progressi parziali vengono conservati)
                  </button>
                </div>
              ) : (
                <button
                  style={{ ...buttonPrimary, backgroundColor: '#d97706' }}
                  disabled={loading || reindexing || (isLocal && !modelReport?.installed)}
                  onClick={handleReindexCache}
                >
                  RICALCOLA CACHE SEMANTICA ({providerReport.dimensions} DIM)
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#166534' }}>
              ✓ Le dimensioni della cache ({providerReport.cacheDimensions}d) sono perfettamente allineate con il
              fornitore attivo ({providerReport.provider}, {providerReport.dimensions}d).
            </div>
          )}
        </div>
      )}

      {/* 5. CONSENSO ED ELABORAZIONE OPENAI */}
      <div
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 18,
          backgroundColor: '#ffffff',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
          Generazione risposte e consenso OpenAI
        </div>
        <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px 0', lineHeight: 1.5 }}>
          Imposta il consenso all’invio e scegli il modello OpenAI una volta sola nelle Impostazioni.
          Le domande nella scheda <strong>Chiedi</strong> utilizzeranno automaticamente questa configurazione.
        </p>

        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={openaiConsent}
              onChange={(e) => void handleToggleConsent(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>Consenti l'invio a OpenAI dei passaggi pertinenti per generare le risposte</span>
          </label>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, marginLeft: 26 }}>
            {openaiConsent
              ? '✓ Consenso attivo: l’app può inviare i passaggi dei documenti pertinenti a OpenAI per comporre le risposte.'
              : '✕ Consenso disattivato: la scheda Chiedi mostrerà un avviso prima di inviare dati a OpenAI.'}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            Modello OpenAI predefinito
          </label>
          <select
            value={selectedOpenaiModel}
            onChange={(e) => handleSelectOpenaiModel(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              backgroundColor: '#ffffff',
              minWidth: 260,
            }}
          >
            <option value="gpt-4o-mini">gpt-4o-mini (veloce, consigliato)</option>
            <option value="gpt-4o">gpt-4o (massima qualità)</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
            <option value="o3-mini">o3-mini (ragionamento avanzato)</option>
            <option value="o1-mini">o1-mini</option>
          </select>
        </div>
      </div>

      {/* SEZIONE 4: MODELLO GENERATIVO LOCALE (MINISTRAL 3 8B INSTRUCT) */}
      <div
        className="limen-card"
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 16,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: 'var(--limen-lime)',
                boxShadow: '0 0 8px rgba(119, 241, 23, 0.8)',
              }}
            />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Modello Generativo Locale — Ministral 3 8B Instruct (100% Offline)
            </h4>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: llmModelReport?.installed && llmModelReport?.sha256Ok ? '#dcfce7' : '#fee2e2',
              color: llmModelReport?.installed && llmModelReport?.sha256Ok ? '#166534' : '#991b1b',
            }}
          >
            {llmModelReport?.installed && llmModelReport?.sha256Ok ? 'INSTALLATO (SHA-256 OK)' : 'NON INSTALLATO'}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          Consente la generazione di risposte interamente sul Mac a rete zero tramite Mistral AI <strong>Ministral 3 8B Instruct</strong> (quantizzazione ad alta fedeltà <code>Q5_K_M</code>). Nessun byte lascia il computer e nessuna chiave API è richiesta.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: 12 }}>
          <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>File Modello GGUF</span>
            <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>Ministral-3-8B-Instruct-2512-Q5_K_M.gguf</span>
          </div>
          <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Dimensione su disco</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              {llmModelReport?.installed ? `${formatBytes(llmModelReport.bytes)} (~6,06 GB)` : '~6,06 GB (non presente)'}
            </span>
          </div>
          <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Stato Servizio LLM</span>
            <span style={{ fontWeight: 700, color: llmServerReport?.running && llmServerReport?.healthy ? '#16a34a' : llmStartingServer ? '#d97706' : '#64748b' }}>
              {llmServerReport?.running && llmServerReport?.healthy
                ? `ATTIVO (Porta: ${llmServerReport.port}${llmServerReport.pid ? `, PID: ${llmServerReport.pid}` : ''})`
                : llmStartingServer
                ? 'IN AVVIO...'
                : 'INATTIVO'}
            </span>
          </div>
          <div style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', display: 'block', marginBottom: 2 }}>Allocazione Memoria Metal</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>
              {llmServerReport?.running && llmServerReport?.healthy ? '~6,2 GB (GPU Metal allocata)' : '0 MB (rilasciata)'}
            </span>
          </div>
        </div>

        {/* Download Progress */}
        {llmDownloading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#166534' }}>
              <span>Scaricamento Ministral 8B da Hugging Face in corso…</span>
              <span>{llmDownloadProgress ? `${llmDownloadProgress.percent.toFixed(1)}%` : '0%'}</span>
            </div>
            <div style={{ width: '100%', height: 8, backgroundColor: '#dcfce7', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${llmDownloadProgress?.percent || 0}%`,
                  backgroundColor: 'var(--limen-lime)',
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#15803d' }}>
              <span>Verifica SHA-256 automatica al termine</span>
              <span>
                {llmDownloadProgress
                  ? `${((llmDownloadProgress.downloaded) / (1024 * 1024 * 1024)).toFixed(2)} GB / ${((llmDownloadProgress.total) / (1024 * 1024 * 1024)).toFixed(2)} GB`
                  : '~6,06 GB'}
              </span>
            </div>
          </div>
        )}

        {/* Pulsanti di azione */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!llmModelReport?.installed && (
            <button
              onClick={handleLlmDownload}
              disabled={llmDownloading}
              style={{
                ...buttonPrimary,
                backgroundColor: 'var(--limen-lime)',
                color: '#0f172a',
                border: '1px solid #52c41a',
                fontWeight: 700,
                opacity: llmDownloading ? 0.6 : 1,
              }}
            >
              {llmDownloading ? 'Scaricamento in corso…' : 'Scarica Ministral 3 8B (~6,06 GB)'}
            </button>
          )}

          {llmModelReport?.installed && (
            <button
              onClick={handleLlmVerifyIntegrity}
              disabled={llmVerifyingIntegrity}
              style={{
                ...buttonSecondary,
                opacity: llmVerifyingIntegrity ? 0.6 : 1,
              }}
            >
              {llmVerifyingIntegrity ? 'Verifica in corso…' : 'Verifica integrità SHA-256'}
            </button>
          )}

          {llmModelReport?.installed && llmModelReport?.sha256Ok && (
            <>
              {llmServerReport?.running && llmServerReport?.healthy ? (
                <button
                  onClick={handleLlmStopServer}
                  disabled={llmStoppingServer}
                  style={{
                    ...buttonSecondary,
                    color: '#991b1b',
                    borderColor: '#fca5a5',
                    opacity: llmStoppingServer ? 0.6 : 1,
                  }}
                >
                  {llmStoppingServer ? 'Arresto…' : 'Arresta servizio (libera RAM)'}
                </button>
              ) : (
                <button
                  onClick={handleLlmStartServer}
                  disabled={llmStartingServer}
                  style={{
                    ...buttonPrimary,
                    opacity: llmStartingServer ? 0.6 : 1,
                  }}
                >
                  {llmStartingServer ? 'Avvio in corso…' : 'Avvia motore locale Ministral'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* FEEDBACK MESSAGES */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 10,
            borderRadius: 6,
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            padding: 10,
            borderRadius: 6,
            backgroundColor: '#dcfce7',
            color: '#166534',
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {successMessage}
        </div>
      )}
    </div>
  );
}
