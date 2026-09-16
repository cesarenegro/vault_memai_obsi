import {labelIt, MessageIt} from './locale';
import {KnowledgePanel} from './KnowledgePanel';
import {ProposalPanel} from './ProposalPanel';
import {SyncPanel} from './SyncPanel';
import {aiIpc} from './ai-ipc';
import {AiPanel,AiSettings} from './AiPanel';
import React, { useState, useEffect, useRef } from 'react';
import {createLatestRequest} from './latest-request';
import { invoke } from '@tauri-apps/api/core';
import {
  createVaultIpc,
  type VaultIntegrityReportResponse,
  type SnapshotItemResponse,
  type RawSourceItem,
  type ProposalItem,
  type BatchCompilerReport,
  type SearchResultItem,
  type IndexStatusReport,
} from './vault-ipc';
import {
  StatusBadge,
  MetricCard,
  EmptyState,
  VaultStatusBanner,
} from '@limen-vault/ui';
import {
  Home,
  MessageSquare,
  BookOpen,
  FolderArchive,
  Search,
  Sparkles,
  FileCheck,
  History,
  Activity,
  Settings,
  PlusCircle,
  FolderOpen,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Cloud,
  ChevronRight,
  RotateCw,
} from 'lucide-react';

type NavTab =
  | 'home'
  | 'ask'
  | 'knowledge'
  | 'sources'
  | 'search'
  | 'outputs'
  | 'proposals'
  | 'snapshots'
  | 'transfers'
  | 'system'
  | 'settings';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [vaultLoaded, setVaultLoaded] = useState<boolean>(false);
  const [vaultState, setVaultState] = useState<'READY' | 'INITIALIZING' | 'INVALID' | 'NO_VAULT' | 'NOT_ACCESSIBLE' | 'INCOMPLETE'>('NO_VAULT');
  const [customPathInput, setCustomPathInput] = useState<string>('');
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  useEffect(() => { void aiIpc.mcpStop().catch(() => {}); void aiIpc.tunnelStop().catch(() => {}); }, [vaultPath]);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [sourceCount, setSourceCount] = useState<number>(0);
  const [proposalCount, setProposalCount] = useState<number>(0);
  const [integrityStatus, setIntegrityStatus] = useState<'valid' | 'corrupted' | 'unverified'>('unverified');
  const [integrityReport, setIntegrityReport] = useState<VaultIntegrityReportResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [obsidianAvailable, setObsidianAvailable] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('clients');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isTauriEnv, setIsTauriEnv] = useState<boolean>(false);
  const [snapshotNoteInput, setSnapshotNoteInput] = useState<string>('');

  const [snapshotsList, setSnapshotsList] = useState<SnapshotItemResponse[]>([]);
  const [rawSourcesList, setRawSourcesList] = useState<RawSourceItem[]>([]);
  const [proposalsList, setProposalsList] = useState<ProposalItem[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ProposalItem | null>(null);
  const [lastBatchReport, setLastBatchReport] = useState<BatchCompilerReport | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchCategory, setSearchCategory] = useState<string>('');
  const [searchClient,setSearchClient]=useState('');
  const [searchProject,setSearchProject]=useState('');
  const [searchTags,setSearchTags]=useState('');
  const [searchStatusFilter,setSearchStatusFilter]=useState('');
  const [searchLoading,setSearchLoading]=useState(false);
  const [searchRevision,setSearchRevision]=useState(0);
  const searchRequest=useRef(createLatestRequest<{status:IndexStatusReport,results:SearchResultItem[]}>()).current;
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchIndexStatus, setSearchIndexStatus] = useState<IndexStatusReport | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const ipc = useRef(createVaultIpc(invoke, () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)).current;
  useEffect(() => () => { generation.current++; }, []);
  const begin = () => { if (busy.current) return null; busy.current=true; setIsProcessing(true); return ++generation.current; };
  const finish = (ticket:number) => { if(ticket===generation.current) {busy.current=false;setIsProcessing(false);} };


  // Detect Tauri Environment & Default Vault Path
  useEffect(() => {
    let cancelled = false;
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauriEnv(isTauri);

    if (isTauri) {
      invoke<string>('get_default_vault_path')
        .then((defaultPath) => {
          if(!cancelled) setCustomPathInput(current => current || defaultPath);
        })
        .catch(() => {
          if(!cancelled) setCustomPathInput(current => current);
        });

      invoke<boolean>('check_obsidian_installed')
        .then((installed) => {
          if(!cancelled) setObsidianAvailable(installed);
        })
        .catch(() => {
          if(!cancelled) setObsidianAvailable(false);
        });
    }
    return () => {cancelled=true;};
  }, []);

  const refreshSnapshotsAndIntegrity = async (target: string, ticket: number) => {
    try {
      const {snapshots,integrity}=await ipc.inspect(target);
      if(ticket!==generation.current)return;
      setSnapshotsList(snapshots);setIntegrityReport(integrity);
      setIntegrityStatus(integrity.is_integrity_valid?'valid':integrity.errors.length?'unverified':'corrupted');
      if(integrity.errors.length)setActionError(integrity.errors.join('; '));

    } catch(e) {
      if(ticket!==generation.current)return;
      setSnapshotsList([]);setIntegrityReport(null);setIntegrityStatus('unverified');
      setActionError(`Aggiornamento integrità non riuscito: ${e instanceof Error?e.message:String(e)}`);
    }
  };
  const refreshCompiler = async (target:string,ticket:number) => {
    try {
      const sources=await ipc.listRawSources(target);
      const proposals=await ipc.listProposals(target);
      if(ticket!==generation.current)return;
      setRawSourcesList(sources);setSourceCount(sources.length);
      setProposalsList(proposals);setProposalCount(proposals.length);
    }catch(e){if(ticket===generation.current){setRawSourcesList([]);setProposalsList([]);setActionError(`Aggiornamento delle fonti non riuscito: ${String(e)}`);}}
  };
  const handleRecheck = async () => {
    if(!vaultPath)return;const ticket=begin();if(ticket===null)return;setActionError(null);
    try{await refreshSnapshotsAndIntegrity(vaultPath,ticket);await refreshCompiler(vaultPath,ticket);}finally{finish(ticket);}
  };

  const handleCreateVault = async () => {
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Serve l’applicazione nativa LIMEN. Questa è un’anteprima nel browser.');
      return;
    }

    const target = customPathInput.trim();
    if (!target) return;

    const ticket=begin(); if(ticket===null)return;
    setIntegrityReport(null);setSnapshotsList([]);setIntegrityStatus('unverified');setRawSourcesList([]);setProposalsList([]);setLastBatchReport(null);
    try {
      const res = await ipc.create(target);
      if(ticket!==generation.current)return;

      setVaultPath(res.path);
      setVaultName(res.name);
      setVaultState(res.state);
      setPageCount(res.page_count);
      setSourceCount(res.source_count);
      setProposalCount(res.proposal_count);
      setValidationErrors([]);
      setValidationWarnings([]);
      setVaultLoaded(res.state === 'READY');

      if (res.path) {
        await refreshSnapshotsAndIntegrity(res.path,ticket);
        await refreshCompiler(res.path,ticket);
      }
    } catch (err) {
      if(ticket!==generation.current)return;
      setActionError(typeof err === 'string' ? err : (err as Error).message);
      setVaultLoaded(false);
      setVaultState('INVALID');
    } finally {
      finish(ticket);
    }
  };

  const handleOpenExistingVault = async () => {
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Serve l’applicazione nativa LIMEN. Questa è un’anteprima nel browser.');
      return;
    }

    const target = customPathInput.trim();
    if (!target) return;

    const ticket=begin(); if(ticket===null)return;
    setIntegrityReport(null);setSnapshotsList([]);setIntegrityStatus('unverified');setRawSourcesList([]);setProposalsList([]);setLastBatchReport(null);
    try {
      const res = await ipc.open(target);
      if(ticket!==generation.current)return;

      setVaultPath(res.status.path);
      setVaultName(res.status.name);
      setVaultState(res.status.state);
      setPageCount(res.status.page_count);
      setSourceCount(res.status.source_count);
      setProposalCount(res.status.proposal_count);
      setValidationErrors(res.validation.errors || []);
      setValidationWarnings(res.validation.warnings || []);
      setVaultLoaded(res.validation.is_valid);

      if (res.status.path && res.validation.is_valid) {
        await refreshSnapshotsAndIntegrity(res.status.path,ticket);
        await refreshCompiler(res.status.path,ticket);
      }
    } catch (err) {
      if(ticket!==generation.current)return;
      setActionError(typeof err === 'string' ? err : (err as Error).message);
      setVaultLoaded(false);
      setVaultState('NOT_ACCESSIBLE');
    } finally {
      finish(ticket);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!vaultPath) return;
    setActionError(null);

    if (!isTauriEnv) {
      setActionError('Apri l’applicazione nativa LIMEN per creare copie locali.');
      return;
    }

    const ticket=begin(); if(ticket===null)return;
    try {
      await ipc.createSnapshot(vaultPath,snapshotNoteInput.trim() || undefined);
      if(ticket!==generation.current)return;
      setSnapshotNoteInput('');
      await refreshSnapshotsAndIntegrity(vaultPath,ticket);
    } catch (err) {
      if(ticket!==generation.current)return;
      setActionError(`Creazione della copia non riuscita: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleCompileSingleSource = async (relPath: string) => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Apri l’applicazione nativa LIMEN per compilare le fonti.');
      return;
    }
    const ticket = begin(); if (ticket === null) return;
    try {
      const res = await ipc.compileSource(vaultPath, relPath);
      if (ticket !== generation.current) return;
      if (res.status === 'error' || res.status === 'unsupported') {
        setActionError(`Compilazione non riuscita per ${relPath}: ${res.error}`);
      }
      await refreshSnapshotsAndIntegrity(vaultPath,ticket);
      await refreshCompiler(vaultPath,ticket);
    } catch (err) {
      if (ticket !== generation.current) return;
      setActionError(`Compilazione della fonte non riuscita: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleBatchCompile = async () => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Apri l’applicazione nativa LIMEN per compilare tutte le fonti.');
      return;
    }
    const ticket = begin(); if (ticket === null) return;
    try {
      const report = await ipc.batchCompileSources(vaultPath);
      if (ticket !== generation.current) return;
      setLastBatchReport(report);
      await refreshSnapshotsAndIntegrity(vaultPath,ticket);
      await refreshCompiler(vaultPath,ticket);
    } catch (err) {
      if (ticket !== generation.current) return;
      setActionError(`Compilazione delle fonti non riuscita: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  useEffect(()=>{
    searchRequest.invalidate();setSearchResults([]);setSearchIndexStatus(null);
    if(!vaultPath||!isTauriEnv||currentTab!=='search'){setSearchLoading(false);return;}
    setSearchLoading(true);setActionError(null);
    const timer=setTimeout(()=>{
      void searchRequest.run(async()=>{
        const status=await ipc.getSearchIndexStatus(vaultPath);
        const results=status.state==='ready'?await ipc.searchVault(vaultPath,{term:searchTerm.trim()||undefined,category:searchCategory||undefined,client:searchClient.trim()||undefined,project:searchProject.trim()||undefined,tags:searchTags.split(',').map(t=>t.trim()).filter(Boolean),status:searchStatusFilter||undefined}):[];
        return {status,results};
      },value=>{setSearchIndexStatus(value.status);setSearchResults(value.results);setSearchLoading(false);},error=>{setActionError(`Ricerca non riuscita: ${String(error)}`);setSearchLoading(false);});
    },180);
    return ()=>{clearTimeout(timer);searchRequest.invalidate();};
  },[vaultPath,isTauriEnv,currentTab,searchTerm,searchCategory,searchClient,searchProject,searchTags,searchStatusFilter,searchRevision,searchRequest,ipc]);

  const handleReindexSearch = async () => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Apri l’applicazione nativa LIMEN per creare l’indice di ricerca.');
      return;
    }
    const ticket = begin(); if (ticket === null) return;
    try {
      const statusReport = await ipc.indexVaultSearch(vaultPath);
      if (ticket !== generation.current) return;
      setSearchIndexStatus(statusReport);
      setSearchRevision(value=>value+1);
    } catch (err) {
      if (ticket !== generation.current) return;
      setActionError(`Indicizzazione non riuscita: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleOpenObsidian = async () => {
    if (!vaultPath) return;
    setActionError(null);

    if (!isTauriEnv) {
      setActionError('Apri l’applicazione nativa LIMEN per avviare Obsidian.');
      return;
    }

    try {
      await ipc.obsidian(vaultPath);
    } catch (err) {
      setActionError(`Avvio di Obsidian non riuscito: ${typeof err === 'string' ? err : (err as Error).message}`);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--limen-bg-app)' }}>
      {/* SIDEBAR NAVIGATION */}
      <aside
        style={{
          width: 240,
          backgroundColor: 'var(--limen-bg-sidebar)',
          borderRight: '1px solid var(--limen-border-light)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 12px',
          userSelect: 'none',
        }}
      >
        <div>
          {/* LOGO */}
          <div style={{ padding: '8px 12px 20px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: '#0f172a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              L
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--limen-text-primary)' }}>
                LIMEN VAULT
              </div>
              <div style={{ fontSize: 10, color: 'var(--limen-text-muted)', fontWeight: 500 }}>
                Desktop v0.2.0 {isTauriEnv ? '(app nativa)' : '(anteprima browser)'}
              </div>
            </div>
          </div>

          {/* MAIN NAV LIST */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { id: 'home', label: 'Panoramica', icon: <Home size={16} /> },
              { id: 'ask', label: 'Chiedi al Vault', icon: <MessageSquare size={16} />, badge: 'M6' },
              { id: 'knowledge', label: 'Conoscenza', icon: <BookOpen size={16} /> },
              { id: 'sources', label: 'Fonti', icon: <FolderArchive size={16} /> },
              { id: 'search', label: 'Ricerca', icon: <Search size={16} /> },
              { id: 'outputs', label: 'Risposte AI', icon: <Sparkles size={16} /> },
              { id: 'proposals', label: 'Proposte', icon: <FileCheck size={16} /> },
              { id: 'snapshots', label: 'Copie locali', icon: <History size={16} />, badge: 'M3' },
              { id: 'transfers', label: 'Trasferimenti', icon: <Cloud size={16} />, badge: 'M10' },
              { id: 'system', label: 'Sistema', icon: <Activity size={16} /> },
              { id: 'settings', label: 'Impostazioni', icon: <Settings size={16} /> },
            ].map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id as NavTab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    color: active ? '#0f172a' : '#475569',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    fontWeight: active ? 600 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#64748b' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* BOTTOM QUICK LAUNCHER */}
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--limen-border-light)' }}>
          <button
            onClick={handleOpenObsidian}
            disabled={!vaultLoaded || !obsidianAvailable || isProcessing}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--limen-border-light)',
              backgroundColor: vaultLoaded && obsidianAvailable ? '#ffffff' : '#f8fafc',
              color: vaultLoaded && obsidianAvailable ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: vaultLoaded && obsidianAvailable ? 'pointer' : 'not-allowed',
            }}
          >
            <ExternalLink size={14} />
            <span>Apri in Obsidian</span>
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT COLUMN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* TOP NAVBAR WITH REFRESH BUTTON IN CENTER */}
        <header
          style={{
            height: 52,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--limen-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            userSelect: 'none',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* LEFT: Current Section Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {currentTab === 'home' && 'Panoramica'}
              {currentTab === 'ask' && 'Chiedi al Vault'}
              {currentTab === 'knowledge' && 'Conoscenza'}
              {currentTab === 'sources' && 'Fonti originali (RAW)'}
              {currentTab === 'search' && 'Ricerca'}
              {currentTab === 'outputs' && 'Risposte AI salvate'}
              {currentTab === 'proposals' && 'Revisione delle proposte'}
              {currentTab === 'snapshots' && 'Copie locali'}
              {currentTab === 'transfers' && 'Trasferimenti'}
              {currentTab === 'system' && 'Sistema'}
              {currentTab === 'settings' && 'Impostazioni'}
            </span>
            {vaultPath && (
              <span style={{ fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                {vaultPath.split('/').pop()}
              </span>
            )}
          </div>

          {/* CENTER: REFRESH BUTTON (RICHIESTO DALL'UTENTE) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={handleRecheck}
              disabled={isProcessing || !vaultPath}
              title="Aggiorna stato, file e dati del Vault"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 18px',
                borderRadius: 20,
                border: '1.5px solid #cbd5e1',
                backgroundColor: isProcessing ? '#f1f5f9' : '#ffffff',
                color: isProcessing ? '#94a3b8' : '#0f172a',
                fontSize: 13,
                fontWeight: 600,
                cursor: isProcessing || !vaultPath ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isProcessing && vaultPath) {
                  e.currentTarget.style.borderColor = '#0f172a';
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessing && vaultPath) {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }
              }}
            >
              <RotateCw size={15} className={isProcessing ? 'spin' : ''} color={isProcessing ? '#94a3b8' : '#0f172a'} />
              <span>{isProcessing ? 'Aggiornamento...' : 'Aggiorna'}</span>
            </button>
          </div>

          {/* RIGHT: Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {vaultLoaded ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 12,
                  backgroundColor: vaultState === 'READY' ? '#dcfce7' : '#fee2e2',
                  color: vaultState === 'READY' ? '#15803d' : '#b91c1c',
                  border: '1px solid',
                  borderColor: vaultState === 'READY' ? '#bbf7d0' : '#fecaca',
                }}
              >
                ● {labelIt(vaultState)}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Nessun Vault</span>
            )}
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {/* BROWSER WARNING BANNER */}
        {!isTauriEnv && (
          <div
            style={{
              backgroundColor: '#fffbe5',
              border: '1px solid #fef08a',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#854d0e',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={18} color="#ca8a04" />
            <div>
              <strong>Modalità anteprima nel browser:</strong> Per usare i file locali, verificare le copie e aprire Obsidian serve l’applicazione nativa. Queste operazioni non sono disponibili nell’anteprima del browser.
            </div>
          </div>
        )}

        {/* ACTION ERROR DISPLAY */}
        {actionError && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            <strong>Errore:</strong> {<MessageIt value={actionError}/>}
          </div>
        )}

        {/* FIRST RUN UX BANNER IF NO VAULT */}
        {!vaultLoaded ? (
          <div
            className="limen-card"
            style={{
              maxWidth: 600,
              margin: '60px auto',
              padding: 36,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              Benvenuto in LIMEN Vault
            </div>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 28px 0' }}>
              Un ambiente di conoscenza locale e indipendente. Crea un nuovo Vault compatibile con Obsidian oppure apri la cartella di un Vault esistente.
            </p>

            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Percorso del Vault (cartella locale)
              </label>
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                placeholder="es. /Users/nome/Documents/IL_MIO_VAULT"
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={handleCreateVault}
                disabled={!customPathInput.trim() || isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: customPathInput.trim() && !isProcessing ? '#0f172a' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: customPathInput.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                }}
              >
                {isProcessing ? <Loader2 size={16} className="spin" /> : <PlusCircle size={16} />}
                <span>CREA NUOVO VAULT</span>
              </button>

              <button
                onClick={handleOpenExistingVault}
                disabled={!customPathInput.trim() || isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#ffffff',
                  color: customPathInput.trim() && !isProcessing ? '#0f172a' : '#94a3b8',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: customPathInput.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                }}
              >
                {isProcessing ? <Loader2 size={16} className="spin" /> : <FolderOpen size={16} />}
                <span>APRI VAULT ESISTENTE</span>
              </button>
            </div>

            {/* VALIDATION ERRORS IN WELCOME CARD */}
            {validationErrors.length > 0 && (
              <div style={{ marginTop: 24, textAlign: 'left', backgroundColor: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
                  Errori di validazione del Vault ({validationErrors.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#b91c1c' }}>
                  {validationErrors.map((err, i) => (
                    <li key={i}>{<MessageIt value={err}/>}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* VAULT BANNER */}
            <VaultStatusBanner
              status={vaultState === 'READY' ? 'READY' : 'INVALID'}
              vaultName={vaultName}
              vaultPath={vaultPath}
              pageCount={pageCount}
              onOpenObsidian={handleOpenObsidian}
              obsidianAvailable={obsidianAvailable}
            />

            {/* SCREEN RENDERER */}
            {currentTab === 'home' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                  <MetricCard title="File Markdown" value={pageCount} subtitle="Tutti i file Markdown del Vault" />
                  <MetricCard title="Fonti originali" value={sourceCount} subtitle="Documenti in sola lettura" />
                  <MetricCard title="File delle proposte" value={proposalCount} subtitle="Revisioni delle bozze salvate" />
                  <MetricCard
                    title="Integrità SHA-256"
                    value={integrityReport?.is_integrity_valid ? 'Verificata' : integrityReport?.errors.length ? 'Non verificata' : integrityReport ? 'Differenze rilevate' : 'Non verificata'}
                    subtitle={
                      integrityReport?.is_integrity_valid
                        ? `Tutti i ${integrityReport.verified_files_count} file corrispondono alle impronte SHA-256`
                        : integrityReport?.errors.length
                        ? 'Verifica non completata'
                        : integrityReport
                        ? `${integrityReport.modified_files.length} modificati, ${integrityReport.missing_files.length} mancanti, ${integrityReport.added_files.length} aggiunti`
                        : 'Impronte crittografiche non verificate'
                    }
                  />
                </div>

                {/* SHA-256 DISCREPANCIES CARD IF ANY */}
                {integrityReport && !integrityReport.is_integrity_valid && integrityReport.errors.length === 0 && (
                  <div style={{ marginBottom: 24, backgroundColor: '#fffbe5', padding: 16, borderRadius: 8, border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', marginBottom: 8 }}>
                      Differenze rilevate rispetto al manifesto SHA-256
                    </div>
                    {integrityReport.modified_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207', marginBottom: 4 }}>
                        <strong>File modificati ({integrityReport.modified_files.length}):</strong> {integrityReport.modified_files.join(', ')}
                      </div>
                    )}
                    {integrityReport.missing_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207', marginBottom: 4 }}>
                        <strong>File mancanti ({integrityReport.missing_files.length}):</strong> {integrityReport.missing_files.join(', ')}
                      </div>
                    )}
                    {integrityReport.added_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207' }}>
                        <strong>File aggiunti non presenti nel manifesto ({integrityReport.added_files.length}):</strong> {integrityReport.added_files.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                  <div className="limen-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Accesso rapido</h3>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Aree operative e cartelle del Vault</span>
                    </div>

                    {/* VAULT / RAW (20_RAW_SOURCES) CARD */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setCurrentTab('sources')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCurrentTab('sources'); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        backgroundColor: '#f1f5f9',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 10,
                        cursor: 'pointer',
                        marginBottom: 16,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0f172a';
                        e.currentTarget.style.backgroundColor = '#e2e8f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FolderArchive size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                              Vault / RAW
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: 'monospace',
                                backgroundColor: '#e2e8f0',
                                padding: '1px 6px',
                                borderRadius: 4,
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            >
                              20_RAW_SOURCES
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Documenti originali, note grezze, brief e file di testo da compilare
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 12,
                            backgroundColor: sourceCount > 0 ? '#dbeafe' : '#f8fafc',
                            color: sourceCount > 0 ? '#1e40af' : '#64748b',
                            border: '1px solid',
                            borderColor: sourceCount > 0 ? '#bfdbfe' : '#e2e8f0',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sourceCount} {sourceCount === 1 ? 'fonte' : 'fonti'}
                        </span>
                        <ChevronRight size={18} color="#64748b" />
                      </div>
                    </div>

                    {/* CARTELLE DELLA CONOSCENZA */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Cartelle della Conoscenza (Note Markdown)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {[
                        { id: 'clients', folder: '01_CLIENTS' },
                        { id: 'projects', folder: '02_PROJECTS' },
                        { id: 'brands', folder: '03_BRANDS' },
                        { id: 'positioning', folder: '04_POSITIONING' },
                        { id: 'packaging', folder: '05_PACKAGING_KNOWLEDGE' },
                        { id: 'methods', folder: '06_METHODS' },
                        { id: 'case_studies', folder: '07_CASE_STUDIES' },
                        { id: 'research', folder: '08_MARKET_RESEARCH' },
                        { id: 'competitors', folder: '09_COMPETITORS' },
                        { id: 'approved_outputs', folder: '10_APPROVED_OUTPUTS' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setCurrentTab('knowledge');
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '10px 14px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            {labelIt(cat.id)}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', marginTop: 2 }}>
                            {cat.folder}/
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="limen-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0' }}>Integrazione AI</h3>
                    <button onClick={() => setCurrentTab('ask')} className="limen-btn-primary">Chiedi al Vault</button>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 12 }}>
                      Controlla le fonti locali prima di inviare una domanda a OpenAI. Configura le credenziali e MCP in sola lettura nelle Impostazioni.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'ask' && (
              <AiPanel key={vaultPath} vaultPath={vaultPath!} />
            )}

            {currentTab === 'knowledge' && (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                  {['clients', 'projects', 'brands', 'positioning', 'packaging', 'methods', 'case_studies', 'research', 'competitors', 'approved_outputs'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: selectedCategory === cat ? '#0f172a' : 'transparent',
                        color: selectedCategory === cat ? '#ffffff' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {labelIt(cat)}
                    </button>
                  ))}
                </div>

                <KnowledgePanel vaultPath={vaultPath!} category={selectedCategory} />
              </div>
            )}

            {currentTab === 'sources' && (
              <div className="limen-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Fonti originali (20_RAW_SOURCES)</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      File originali conservati in sola lettura. La compilazione estrae il testo locale e crea bozze in <code>90_PROPOSALS/</code> con <code>status: draft</code>.
                    </div>
                  </div>

                  <button
                    onClick={handleBatchCompile}
                    disabled={isProcessing || !vaultPath || rawSourcesList.length === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: isProcessing || !vaultPath || rawSourcesList.length === 0 ? '#94a3b8' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isProcessing || !vaultPath || rawSourcesList.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isProcessing ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    <span>COMPILA TUTTE LE FONTI</span>
                  </button>
                </div>

                <button onClick={async()=>{if(!vaultPath)return;const ticket=begin();if(ticket===null)return;setActionError(null);try{await refreshCompiler(vaultPath,ticket);}finally{finish(ticket);}}} disabled={isProcessing || !vaultPath} style={{padding:'8px 14px',marginBottom:16,border:'1px solid #cbd5e1',borderRadius:6,backgroundColor:'#ffffff',color:'#334155',fontSize:12,cursor:'pointer'}}>AGGIORNA FONTI</button>

                {lastBatchReport && (
                  <div style={{ marginBottom: 20, backgroundColor: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                    <strong>Riepilogo compilazione:</strong> Compilate: {lastBatchReport.compiled_count} | Invariate: {lastBatchReport.unchanged_count} | Non supportate: {lastBatchReport.unsupported_count} | Errori: {lastBatchReport.error_count}
                    {lastBatchReport.items.filter(item=>item.status==='error').map(item=><p key={item.source_relative_path} style={{color:'#b91c1c'}}>{item.source_relative_path}: {<MessageIt value={item.error}/>}</p>)}
                  </div>
                )}

                {rawSourcesList.length === 0 ? (
                  <EmptyState
                    title="Nessuna fonte originale trovata"
                    description="Inserisci documenti Markdown, testo o HTML nella cartella 20_RAW_SOURCES/ del Vault."
                    icon={<FolderArchive size={32} />}
                  />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Percorso della fonte</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Estensione</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Dimensione</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Stato</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Azione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawSourcesList.map((src) => (
                        <tr key={src.relative_path} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace', color: '#0f172a' }}>{src.relative_path}{src.first_compiled_at && <div style={{fontSize:10,fontWeight:400}}>Prima compilazione: {src.first_compiled_at}</div>}{src.error && <div style={{color:'#b91c1c'}}>{<MessageIt value={src.error}/>}</div>}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>.{src.extension}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{(src.size_bytes / 1024).toFixed(1)} KB</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 4,
                                backgroundColor: src.status === 'COMPILED' ? '#dcfce7' : src.status === 'CHANGED' ? '#fef9c3' : '#f1f5f9',
                                color: src.status === 'COMPILED' ? '#15803d' : src.status === 'CHANGED' ? '#a16207' : '#475569',
                              }}
                            >
                              {labelIt(src.status)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => handleCompileSingleSource(src.relative_path)}
                              disabled={isProcessing}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Compila bozza
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {currentTab === 'search' && (
              <div className="limen-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Ricerca nel testo locale, anche senza rete</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Cerca nelle note Markdown, nelle proposte e nei metadati tramite un indice locale.
                    </div>
                  </div>

                  <button
                    onClick={handleReindexSearch}
                    disabled={isProcessing || !vaultPath}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: isProcessing || !vaultPath ? '#94a3b8' : '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isProcessing || !vaultPath ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isProcessing ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                    <span>AGGIORNA INDICE DI RICERCA</span>
                  </button>
                </div>

                {/* SEARCH INPUT & FILTER BAR */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="Cerca parole, titoli, proprietà, etichette..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);

                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                    }}
                  />

                  <select
                    value={searchCategory}
                    onChange={(e) => {
                      setSearchCategory(e.target.value);

                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                    }}
                  >
                    <option value="">Tutte le categorie</option>
                    <option value="client">Clienti</option>
                    <option value="project">Progetti</option>
                    <option value="brand">Marchi</option>
                    <option value="positioning">Posizionamento</option>
                    <option value="packaging">Confezionamento</option>
                    <option value="method">Metodi</option>
                    <option value="case_study">Casi studio</option>
                    <option value="research">Ricerca di mercato</option>
                    <option value="competitor">Concorrenti</option>
                    <option value="approved_output">Contenuti approvati</option>
                    <option value="proposal">Proposte (90_PROPOSALS)</option>
                    <option value="ai_output">Risposte AI (80_AI_OUTPUTS)</option>
                  </select>
                </div>

                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
                  <input aria-label="Filtra per cliente" placeholder="Cliente" value={searchClient} onChange={e=>setSearchClient(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <input aria-label="Filtra per progetto" placeholder="Progetto" value={searchProject} onChange={e=>setSearchProject(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <input aria-label="Filtra per etichette" placeholder="Etichette separate da virgole" value={searchTags} onChange={e=>setSearchTags(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <select aria-label="Filtra per stato" value={searchStatusFilter} onChange={e=>setSearchStatusFilter(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6,background:'#fff'}}>
                    <option value="">Tutti gli stati</option><option value="approved">Approvata</option><option value="draft">Bozza</option><option value="review">In revisione</option><option value="archived">Archiviata</option>
                  </select>
                </div>
                {searchLoading && <p style={{fontSize:12,color:'#64748b'}}>Ricerca in corso…</p>}
                {/* SEARCH INDEX STATUS BANNER */}
                {searchIndexStatus && (
                  <div style={{ marginBottom: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                    <strong>Stato indice:</strong> {searchIndexStatus.state==='ready'?`${searchIndexStatus.total_indexed} documenti indicizzati il ${new Date(searchIndexStatus.last_indexed_at).toLocaleString("it-IT")}. Aggiorna l’indice dopo aver aggiunto o modificato note.`:'Indice assente o obsoleto. Aggiorna l’indice per cercare.'}
                  </div>
                )}

                {/* SEARCH RESULTS LIST */}
                {searchResults.length === 0 ? (
                  <EmptyState
                    title="Nessun risultato corrispondente"
                    description={searchTerm.trim() ? `Nessun documento corrisponde a "${searchTerm}"` : 'Inserisci un termine oppure premi AGGIORNA INDICE DI RICERCA per creare l’indice locale.'}
                    icon={<Search size={32} />}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      Trovati {searchResults.length} documenti corrispondenti:
                    </div>
                    {searchResults.map((item) => (
                      <div
                        key={item.relative_path}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 16,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.title}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#334155', textTransform: 'uppercase' }}>
                              {labelIt(item.category)}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>
                              Rilevanza: {item.score}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', marginBottom: 8 }}>
                          {item.relative_path}
                        </div>
                        {item.snippet && (
                          <div style={{ fontSize: 13, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{item.snippet}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentTab === 'outputs' && vaultPath && <ProposalPanel key={vaultPath+'outputs'} vaultPath={vaultPath} kind="output"/>}

            {currentTab === 'proposals' && vaultPath && <ProposalPanel key={vaultPath+'proposals'} vaultPath={vaultPath} kind="proposal"/>}

            {currentTab === 'snapshots' && (
              <div className="limen-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Copie locali con cronologia</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Copie locali con verifica SHA-256, salvate in <code>00_SYSTEM/SNAPSHOTS/</code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Nota facoltativa per la copia..."
                      value={snapshotNoteInput}
                      onChange={(e) => setSnapshotNoteInput(e.target.value)}
                      disabled={isProcessing}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        width: 220,
                      }}
                    />
                    <button
                      onClick={handleCreateSnapshot}
                      disabled={isProcessing || !vaultPath}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: isProcessing || !vaultPath ? '#94a3b8' : '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isProcessing || !vaultPath ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isProcessing ? <Loader2 size={14} className="spin" /> : <PlusCircle size={14} />}
                      <span>CREA COPIA LOCALE</span>
                    </button>
                  </div>
                </div>

                <button onClick={handleRecheck} disabled={isProcessing || !vaultPath} style={{ padding: '8px 14px', marginBottom: 16, border: '1px solid #cbd5e1', borderRadius: 6, backgroundColor: '#ffffff', color: '#334155', fontSize: 12, cursor: isProcessing ? 'not-allowed' : 'pointer' }}>VERIFICA INTEGRITÀ</button>
                {snapshotsList.length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    Nessuna copia locale trovata in <code>00_SYSTEM/SNAPSHOTS/</code>. Premi <strong>CREA COPIA LOCALE</strong> per crearne una.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>ID copia</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Data di creazione</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Nota / Descrizione</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Numero di file</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Integrità SHA-256</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshotsList.map((snap) => (
                        <tr key={snap.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace', color: '#0f172a' }}>{snap.id}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {snap.created_at ? new Date(snap.created_at).toLocaleString("it-IT") : 'N/A'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{snap.note || 'Copia locale con cronologia'}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{snap.manifest_file_count} file</td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusBadge
                              status={snap.integrity_status === 'valid' ? 'READY' : 'INVALID'}
                              label={snap.integrity_status === 'valid' ? 'Verificata (SHA-256)' : snap.integrity_status === 'incomplete' ? 'Incompleta' : 'Danneggiata'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {currentTab === 'transfers' && (
              <SyncPanel vaultPath={vaultPath!} />
            )}

            {currentTab === 'system' && (
              <div className="limen-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Stato del sistema locale</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Cartella del Vault</td>
                      <td style={{ padding: '10px 0', color: '#0f172a', fontWeight: 600 }}>{vaultPath}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Applicazione Obsidian</td>
                      <td style={{ padding: '10px 0', color: obsidianAvailable ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                        {obsidianAvailable ? 'Rilevata e disponibile' : 'Non installata o non rilevata'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Motore delle copie locali</td>
                      <td style={{ padding: '10px 0', color: '#047857', fontWeight: 600 }}>
                        Attivo, con verifica SHA-256
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Ambiente di esecuzione</td>
                      <td style={{ padding: '10px 0', color: '#0f172a', fontWeight: 600 }}>
                        {isTauriEnv ? 'Applicazione nativa macOS' : 'Anteprima nel browser'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Servizi remoti</td>
                      <td style={{ padding: '10px 0', color: '#64748b', fontWeight: 600 }}>Opzionali: il Vault locale funziona senza rete</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {currentTab === 'settings' && (<><AiSettings key={vaultPath} vaultPath={vaultPath!} />
              <div className="limen-card" style={{ padding: 24, maxWidth: 640 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Impostazioni del Vault</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Cartella locale del Vault
                  </label>
                  <input
                    type="text"
                    value={vaultPath || ''}
                    onChange={(e) => setVaultPath(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>
            </>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  );
}
