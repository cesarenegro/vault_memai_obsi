import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  aiIpc,
  type EmbeddingsProviderReport,
  type LocalModelReport,
  type LocalServerReport,
  type LocalModelProgress,
} from './ai-ipc';

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
  const [providerReport, setProviderReport] = useState<EmbeddingsProviderReport | null>(null);
  const [modelReport, setModelReport] = useState<LocalModelReport | null>(null);
  const [serverReport, setServerReport] = useState<LocalServerReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<LocalModelProgress | null>(null);

  const [startingServer, setStartingServer] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexPercent, setReindexPercent] = useState<number | null>(null);
  const [reindexCounts, setReindexCounts] = useState<{ processed: number; total: number } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  const refreshAll = async () => {
    if (!vaultPath) return;
    try {
      const [prov, model, srv] = await Promise.all([
        aiIpc.embeddingsGetProvider(vaultPath),
        aiIpc.localModelStatus(),
        aiIpc.localServerStatus(),
      ]);
      if (isMounted.current) {
        setProviderReport(prov);
        setModelReport(model);
        setServerReport(srv);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(`Errore nel caricamento delle impostazioni semantiche: ${String(err)}`);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    void refreshAll();

    let unlistenDownload: (() => void) | undefined;
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
      if (unlistenSync) unlistenSync();
    };
  }, [vaultPath]);

  const handleSelectProvider = async (provider: 'openai' | 'local') => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const updated = await aiIpc.embeddingsSetProvider(vaultPath, provider);
      setProviderReport(updated);
      setSuccessMessage(`Fornitore semantico aggiornato a: ${provider === 'local' ? 'Locale (bge-m3)' : 'OpenAI'}`);
      await refreshAll();
    } catch (err) {
      setError(`Impossibile impostare il fornitore: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadModel = async () => {
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
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const rep = await aiIpc.localModelPickAndInstall();
      setModelReport(rep);
      setSuccessMessage('Modello selezionato installato con successo e SHA-256 verificato.');
    } catch (err) {
      setError(`Installazione del file fallita: ${String(err)}`);
    } finally {
      setLoading(false);
      await refreshAll();
    }
  };

  const handleStartServer = async () => {
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
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const rep = await aiIpc.localServerStop();
      setServerReport(rep);
      setSuccessMessage('Servizio locale arrestato.');
    } catch (err) {
      setError(`Arresto del servizio non riuscito: ${String(err)}`);
    } finally {
      setLoading(false);
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

  const isLocal = providerReport?.provider === 'local';

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
        dato esce dal Mac e il funzionamento è a rete zero.
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
            Modello <code>text-embedding-3-small</code> (1536 dim). Richiede chiave API configurata nel Portachiavi e
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
              Locale (bge-m3, nessun dato esce dal Mac)
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
              backgroundColor: modelReport?.installed && modelReport.sha256Ok ? '#dcfce7' : '#fee2e2',
              color: modelReport?.installed && modelReport.sha256Ok ? '#166534' : '#991b1b',
            }}
          >
            {modelReport?.installed && modelReport.sha256Ok
              ? 'INSTALLATO (SHA-256 OK)'
              : modelReport?.installed
              ? 'INTEGRITÀ NON VALIDA'
              : 'NON INSTALLATO'}
          </span>
        </div>

        {modelReport?.installed ? (
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>
              <strong>Percorso:</strong> <code style={{ fontSize: 11 }}>{modelReport.path}</code>
            </div>
            <div>
              <strong>Dimensione:</strong> {formatBytes(modelReport.bytes)} (634.553.760 byte)
            </div>
            <div style={{ color: '#166534', fontWeight: 500, marginTop: 4 }}>
              ✓ Dopo lo scaricamento, il funzionamento è a rete zero. Nessun dato lascia mai questo Mac.
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px 0' }}>
              Il modello non è presente sul Mac. È richiesto un download una tantum di 635 MB dal repository gpustack,
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
                  disabled={loading || downloading}
                  onClick={handleDownloadModel}
                >
                  SCARICA MODELLO (635 MB)
                </button>
                <button
                  style={buttonSecondary}
                  disabled={loading || downloading}
                  onClick={handlePickModelFile}
                >
                  SELEZIONA FILE GGUF DA DISCO…
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
                startingServer
                  ? '#fef3c7'
                  : serverReport?.running && serverReport.healthy
                  ? '#dcfce7'
                  : serverReport?.lastError
                  ? '#fee2e2'
                  : '#f1f5f9',
              color:
                startingServer
                  ? '#92400e'
                  : serverReport?.running && serverReport.healthy
                  ? '#166534'
                  : serverReport?.lastError
                  ? '#991b1b'
                  : '#64748b',
            }}
          >
            {startingServer
              ? 'IN AVVIO…'
              : serverReport?.running && serverReport.healthy
              ? `ATTIVO (PORTA ${serverReport.port})`
              : serverReport?.lastError
              ? 'ERRORE'
              : 'SPENTO'}
          </span>
        </div>

        <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
          {serverReport?.running && serverReport.healthy ? (
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
              style={{ ...buttonSecondary, color: '#b91c1c', border: '1px solid #fecaca' }}
              disabled={loading || startingServer}
              onClick={handleStopServer}
            >
              ARRESTA SERVIZIO LOCALE
            </button>
          ) : (
            <button
              style={buttonSecondary}
              disabled={loading || startingServer || !modelReport?.installed}
              onClick={handleStartServer}
            >
              {startingServer ? 'AVVIO IN CORSO…' : 'AVVIA SERVIZIO LOCALE'}
            </button>
          )}
          <button style={buttonSecondary} onClick={refreshAll} disabled={loading}>
            AGGIORNA STATO
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
