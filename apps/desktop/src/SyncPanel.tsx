import {labelIt, MessageIt} from './locale';
import { getPlatformTerms } from './platform';
import React, { useState, useEffect } from 'react';
import {
  syncIpc,
  type SyncStatus,
  type SyncStatusInfo,
  type TransferOperation,
  type TransferPlanResponse,
  type TransferExecutionResponse,
} from './sync-ipc';
import {
  Cloud,
  CloudOff,
  Upload,
  Download,
  Share2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
} from 'lucide-react';

export function SyncPanel({ vaultPath }: { vaultPath: string }) {
  const terms = getPlatformTerms();
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({ status: 'OFFLINE' });
  const [selectedOp, setSelectedOp] = useState<TransferOperation>('PUBLISH_APPROVED');
  const [plan, setPlan] = useState<TransferPlanResponse | null>(null);
  const [confirmRevoke,setConfirmRevoke]=useState(false);
  const [activeOperation,setActiveOperation]=useState('');
  const [selectedPaths,setSelectedPaths]=useState<string[]>([]);
  const [planning, setPlanning] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<TransferExecutionResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'transfers' | 'settings'>('transfers');

  // Cloud copy configuration state
  const [releases,setReleases]=useState<{releaseId:string;createdAt:string;documentCount:number}[]>([]);
  const [releaseId,setReleaseId]=useState('');
  const [connectionCode,setConnectionCode]=useState('');
  const [cloudEnabled, setCloudEnabled] = useState<boolean>(false);
  const [bucketName, setBucketName] = useState<string>('');
  const [connTesting, setConnTesting] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<string | null>(null);

  const refreshStatus = async () => {
    try {
      const info = await syncIpc.getStatus();
      setSyncInfo(info);
      if (info.bucket) setBucketName(info.bucket);
      setCloudEnabled(info.status === 'READY');
    } catch (e) {
      setSyncInfo({ status: 'FAILED', error: String(e) });
    }
  };

  useEffect(() => {
    refreshStatus();
  }, [vaultPath]);

  useEffect(()=>{if(!executing)return;const timer=window.setInterval(()=>{syncIpc.getStatus().then(setSyncInfo).catch(()=>{});},1000);return()=>window.clearInterval(timer);},[executing]);

  const handlePlan = async (op: TransferOperation) => {
    setSelectedOp(op);
    setPlan(null);
    setExecutionResult(null);
    setError('');
    setPlanning(true);

    try {
      const p = await syncIpc.planTransfer(vaultPath, op, op==='DOWNLOAD_COPY' ? releaseId || undefined : undefined);
      setPlan(p);
      setSelectedPaths([]);
    } catch (err) {
      setError((err as Error).message || 'Errore nella pianificazione del trasferimento');
    } finally {
      setPlanning(false);
    }
  };

  const handleExecute = async () => {
    if (!plan) return;
    setExecuting(true);
    setError('');
    setExecutionResult(null);

    try {
      const operationId = plan.channel==='published' ? await syncIpc.selectNotes(plan.operationId,selectedPaths) : plan.operationId;
      setActiveOperation(operationId);
      const res = await syncIpc.executeTransfer(operationId, vaultPath);
      setExecutionResult(res);
      if (res.status === 'COMMITTED' || res.status === 'DOWNLOADED' || res.status === 'IMPORTED') {
        refreshStatus();
        setPlan(null);
      }
    } catch (err) {
      setError((err as Error).message || 'Errore durante il trasferimento');
    } finally {
      setExecuting(false);
      setActiveOperation('');
      await refreshStatus();
    }
  };

  const handleTestConnection = async () => {
    setConnTesting(true);
    setConnTestResult(null);
    try {
      const res = await syncIpc.testConnection();
      if (res.success) {
        setConnTestResult(`Connessione R2 verificata con successo (${res.latencyMs ?? '—'}ms). Nessun contenuto del Vault trasmesso.`);
      } else {
        setConnTestResult(`Verifica fallita: ${res.error || 'Endpoint non raggiungibile'}`);
      }
    } catch (err) {
      setConnTestResult(`Errore di connessione: ${(err as Error).message}`);
    } finally {
      setConnTesting(false);
    }
  };

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case 'READY':
        return <span style={{ background: '#ecfdf5', color: '#047857', padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>Pronto</span>;
      case 'TRANSFERRING':
      case 'VERIFYING':
        return <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{labelIt(status)}</span>;
      case 'CONFLICT':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>Conflitto</span>;
      case 'FAILED':
      case 'AUTH_REQUIRED':
        return <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{labelIt(status)}</span>;
      case 'DISABLED':
      case 'NOT_CONFIGURED':
      case 'OFFLINE':
      default:
        return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{labelIt(status)}</span>;
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Autonomy & Status Banner */}
      <div className="limen-card" style={{ padding: 20, borderLeft: '4px solid #3b82f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Architettura Indipendente & Cloud R2</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Stato Cloud:</span>
            {getStatusBadge(executing?'TRANSFERRING':syncInfo.status)}
          </div>
        </div>
        <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          <strong>Il Vault locale è sempre autorevole.</strong> L'indisponibilità del cloud o della rete non impedisce
          in alcun modo l'apertura, la ricerca, la compilazione o l'editing dei file {terms.onDeviceTerm}.
        </p>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
          <span>Bucket configurato: <code>{bucketName}</code></span>
          {syncInfo.lastReleaseId && <span>Ultima versione: <code>{syncInfo.lastReleaseId}</code></span>}
        </div>
      </div>

      {syncInfo.pendingOperationId && syncInfo.pendingVaultPath===vaultPath && <button disabled={executing} onClick={async()=>{
        setExecuting(true);setActiveOperation(syncInfo.pendingOperationId!);setError('');try{setExecutionResult(await syncIpc.executeTransfer(syncInfo.pendingOperationId!,vaultPath));await refreshStatus();}catch(e){setError(String(e));}finally{setExecuting(false);setActiveOperation('');}
      }}>Riprendi trasferimento interrotto</button>}
      {executing && activeOperation && <button onClick={async()=>{await syncIpc.cancelTransfer(activeOperation);setError('Annullamento richiesto: attendo il termine della richiesta in corso.');}}>Annulla trasferimento</button>}
      {executing && syncInfo.progress && <p role="status">{syncInfo.progress.completedFiles} / {syncInfo.progress.totalFiles} file completati — {(syncInfo.progress.completedBytes/1024).toFixed(0)} KB verificati</p>}
      {connTestResult && activeTab==='transfers' && <p role="status">{<MessageIt value={connTestResult}/>}</p>}
      {!executing && <div>{confirmRevoke ? <><span>Ritirare le note dalla consultazione cloud? Le copie locali rimangono disponibili. </span><button onClick={async()=>{setExecuting(true);try{await syncIpc.revokePublication();setConnTestResult('Pubblicazione ritirata');setPlan(null);setError('');}catch(e){setError(String(e));}finally{setExecuting(false);setConfirmRevoke(false);}}}>Conferma ritiro</button><button onClick={()=>setConfirmRevoke(false)}>Mantieni pubblicazione</button></> : <button onClick={()=>setConfirmRevoke(true)}>Ritira pubblicazione</button>}</div>}
      <details><summary>Versioni precedenti da recuperare</summary>
        <button onClick={async()=>{try{setReleases(await syncIpc.listReleases());}catch(e){setError(String(e));}}}>Carica versioni</button>
        <select aria-label="Versione da recuperare" value={releaseId} onChange={e=>{setReleaseId(e.target.value);setPlan(null);}}><option value="">Ultima versione</option>{releases.map(r=><option key={r.releaseId} value={r.releaseId}>{r.createdAt} — {r.documentCount} file</option>)}</select>
      </details>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('transfers')}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'transfers' ? '#0f172a' : 'transparent',
            color: activeTab === 'transfers' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Operazioni Trasferimento
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: activeTab === 'settings' ? '#0f172a' : 'transparent',
            color: activeTab === 'settings' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Impostazioni Copia cloud
        </button>
      </div>

      {activeTab === 'transfers' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Operation Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <button
              disabled={executing || planning} onClick={() => handlePlan('PUBLISH_APPROVED')}
              style={{
                padding: 16,
                borderRadius: 8,
                border: selectedOp === 'PUBLISH_APPROVED' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: selectedOp === 'PUBLISH_APPROVED' ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Share2 size={18} color="#2563eb" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Pubblica conoscenza</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Condivisione selettiva: solo note esplicitamente approvate (01–10). Consultabile dal CRM via server.
              </p>
            </button>

            <button
              disabled={executing || planning} onClick={() => handlePlan('UPLOAD_PRIVATE')}
              style={{
                padding: 16,
                borderRadius: 8,
                border: selectedOp === 'UPLOAD_PRIVATE' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                background: selectedOp === 'UPLOAD_PRIVATE' ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Upload size={18} color="#0f172a" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Carica versione</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Copia di sicurezza privata: include note, fonti e revisioni. Non visibile al CRM.
              </p>
            </button>

            <button
              disabled={executing || planning} onClick={() => handlePlan('DOWNLOAD_COPY')}
              style={{
                padding: 16,
                borderRadius: 8,
                border: selectedOp === 'DOWNLOAD_COPY' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                background: selectedOp === 'DOWNLOAD_COPY' ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Download size={18} color="#0f172a" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Scarica copia</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Recupera una versione in una cartella temporanea e importala come nuovo Vault, senza sovrascrivere quello esistente.
              </p>
            </button>
          </div>

          {/* Planning Loader / Error */}
          {planning && (
            <div className="limen-card" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
              <RefreshCw className="animate-spin" size={20} style={{ display: 'inline', marginRight: 8 }} />
              Ispezione Vault locale e calcolo piano in corso...
            </div>
          )}

          {error && (
            <div className="limen-card" style={{ padding: 16, borderLeft: '4px solid #ef4444', background: '#fef2f2', color: '#b91c1c' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} />
                <strong>Errore operazione:</strong>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>{<MessageIt value={error}/>}</p>
            </div>
          )}

          {/* Analytical Preview */}
          {plan && (
            <div className="limen-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Anteprima analitica ({plan.eligibleDocuments.length} file compresi, {(plan.totalBytes / 1024).toFixed(1)} KB)
                </h4>
                <button
                  disabled={executing || (plan.channel==='published' && selectedPaths.length===0)}
                  onClick={handleExecute}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {executing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Trasferimento in corso...
                    </>
                  ) : (
                    <>Conferma ed Esegui</>
                  )}
                </button>
              </div>

              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>
                {plan.channel==='published' ? `Seleziona le note da condividere: ${selectedPaths.length} selezionate. La nuova pubblicazione sostituisce quella precedente.` : 'La copia privata comprende tutti i file elencati. Conferma per avviare il trasferimento.'}
              </p>

              {/* Table of eligible files */}
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Percorso</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Categoria</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Stato</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Dimensione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.eligibleDocuments.map((doc) => (
                      <tr key={doc.relativePath} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{plan.channel==='published' && <input type="checkbox" aria-label={`Condividi ${doc.relativePath}`} disabled={executing} checked={selectedPaths.includes(doc.relativePath)} onChange={e=>setSelectedPaths(p=>e.target.checked?[...p,doc.relativePath]:p.filter(x=>x!==doc.relativePath))} />} {doc.relativePath}</td>
                        <td style={{ padding: '6px 12px', color: '#64748b' }}>{labelIt(doc.category)}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                            {labelIt(doc.status)}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#64748b' }}>
                          {(doc.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Excluded paths details */}
              {plan.excludedPaths.length > 0 && (
                <details style={{ fontSize: 12, color: '#64748b' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {plan.excludedPaths.length} elementi esclusi (blocchi operativi, bozze, copie locali, indici)
                  </summary>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                    {plan.excludedPaths.slice(0, 15).map((p) => (
                      <li key={p}><code>{p}</code></li>
                    ))}
                    {plan.excludedPaths.length > 15 && <li>...altri {plan.excludedPaths.length - 15} percorsi esclusi</li>}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Execution Result */}
          {executionResult && (
            <div
              className="limen-card"
              style={{
                padding: 16,
                borderLeft: `4px solid ${
                  executionResult.status === 'COMMITTED' || executionResult.status === 'DOWNLOADED' || executionResult.status === 'IMPORTED'
                    ? '#10b981'
                    : executionResult.status === 'CONFLICT'
                    ? '#f59e0b'
                    : '#ef4444'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {executionResult.status === 'COMMITTED' || executionResult.status === 'DOWNLOADED' || executionResult.status === 'IMPORTED' ? (
                  <CheckCircle2 size={18} color="#10b981" />
                ) : executionResult.status === 'CONFLICT' ? (
                  <AlertTriangle size={18} color="#f59e0b" />
                ) : (
                  <XCircle size={18} color="#ef4444" />
                )}
                <strong style={{ fontSize: 14 }}>
                  {executionResult.status === 'COMMITTED' && 'Trasferimento e salvataggio su R2 completati'}
                  {executionResult.status === 'DOWNLOADED' && 'Scaricamento e verifica delle impronte completati nella cartella temporanea'}
                  {executionResult.status === 'IMPORTED' && 'Nuovo Vault importato correttamente'}
                  {executionResult.status === 'CONFLICT' && 'Conflitto di Concorrenza: Versione Base Disallineata'}
                  {executionResult.status === 'FAILED' && 'Trasferimento non riuscito'}
                </strong>
              </div>
              {executionResult.targetVaultPath && <p>Copia salvata: {executionResult.targetVaultPath}</p>}
              {executionResult.releaseId && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#334155' }}>
                  ID versione: <code>{executionResult.releaseId}</code>
                </p>
              )}
              {executionResult.conflictWith && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#b45309' }}>
                  Il server ha una versione più recente (<code>{executionResult.conflictWith}</code>). Ricaricare l'anteprima.
                </p>
              )}
              {executionResult.error && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#b91c1c' }}>
                  {<MessageIt value={executionResult.error}/>}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Settings Tab */
        <div className="limen-card" style={{ padding: 24, maxWidth: 640 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Configurazione Copia cloud (Cloudflare R2)</h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px 0' }}>
            Attivazione della destinazione remota per copie versionate e pubblicazione. Disattivato per impostazione predefinita.
          </p>

          <div style={{ display: 'grid', gap: 16 }}>
            <label>Codice di collegamento fornito dall’amministratore
              <input aria-label="Codice collegamento" type="password" autoComplete="off" value={connectionCode} onChange={e=>setConnectionCode(e.target.value)} />
            </label>
            <button disabled={!connectionCode || connTesting} onClick={async()=>{
              setConnTesting(true);try {
                const c=JSON.parse(connectionCode);if(typeof c.endpoint!=='string'||typeof c.token!=='string')throw new Error('Codice non valido');
                await syncIpc.saveConfig({enabled:true,endpoint:c.endpoint});await syncIpc.saveKey(c.token);setConnectionCode('');
                const result=await syncIpc.testConnection();setConnTestResult(result.success?'Collegamento verificato':'Collegamento non riuscito');await refreshStatus();
              } catch(e){setConnTestResult(String(e));}finally{setConnTesting(false);}
            }}>Collega archivio</button>
            <div style={{ display: 'none' }}>
              <input
                type="checkbox"
                id="cloud-toggle"
                checked={cloudEnabled}
                onChange={(e) => setCloudEnabled(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="cloud-toggle" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Abilita sincronizzazione Copia cloud (R2)
              </label>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Bucket R2 di destinazione
              </label>
              <input
                type="text"
                value={bucketName}
                readOnly
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                Destinazione storage R2 con prefisso dedicato isolato <code>limen/</code>.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                disabled={connTesting}
                onClick={handleTestConnection}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: connTesting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {connTesting ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                Test Connessione
              </button>

              <button
                onClick={async () => {
                  await syncIpc.disconnect();
                  setCloudEnabled(false);
                  refreshStatus();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Disconnetti
              </button>
            </div>

            {connTestResult && (
              <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                {<MessageIt value={connTestResult}/>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
