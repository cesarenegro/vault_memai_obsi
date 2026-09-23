import {AutomationPanel,useAutomation} from './AutomationPanel';
import {labelIt, MessageIt} from './locale';
import {KnowledgePanel} from './KnowledgePanel';
import {ProposalPanel} from './ProposalPanel';
import {SyncPanel} from './SyncPanel';
import {HelpPanel} from './HelpPanel';
import {aiIpc} from './ai-ipc';
import {AiPanel,AiSettings} from './AiPanel';
import { DocumentReaderModal } from './DocumentReaderModal';
import React, { useState, useEffect, useRef } from 'react';
import { createLatestRequest } from './latest-request';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  createVaultIpc,
  type VaultIntegrityReportResponse,
  type SnapshotItemResponse,
  type RawSourceItem,
  type ProposalItem,
  type BatchCompilerReport,
  type SearchResultItem,
  type IndexStatusReport,
  type CatalogSummary,
  type DocumentRecord,
  type SnapshotRestoreReport,
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
  HelpCircle,
  Upload,
  FileText,
  FileSpreadsheet,
  Layers,
  Sliders,
  Download,
  Check,
} from 'lucide-react';

type NavTab =
  | 'ask'
  | 'documents'
  | 'memory'
  | 'advanced'
  | 'home'
  | 'knowledge'
  | 'sources'
  | 'search'
  | 'outputs'
  | 'proposals'
  | 'snapshots'
  | 'transfers'
  | 'system'
  | 'help'
  | 'settings';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [vaultLoaded, setVaultLoaded] = useState<boolean>(false);
  const [vaultState, setVaultState] = useState<'READY' | 'INITIALIZING' | 'INVALID' | 'NO_VAULT' | 'NOT_ACCESSIBLE' | 'INCOMPLETE'>('NO_VAULT');
  const [customPathInput, setCustomPathInput] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('limen_last_vault_path') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  useEffect(() => { void aiIpc.mcpStop().catch(() => {}); void aiIpc.tunnelStop().catch(() => {}); }, [vaultPath]);
  const automation=useAutomation(vaultLoaded&&vaultState==='READY'?vaultPath:null);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [sourceCount, setSourceCount] = useState<number>(0);
  const [proposalCount, setProposalCount] = useState<number>(0);
  const [integrityStatus, setIntegrityStatus] = useState<'valid' | 'corrupted' | 'unverified'>('unverified');
  const [integrityReport, setIntegrityReport] = useState<VaultIntegrityReportResponse | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [obsidianAvailable, setObsidianAvailable] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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

  // Unified Catalog and 3-Area State
  const [catalogSummary, setCatalogSummary] = useState<CatalogSummary | null>(null);
  const [catalogDocuments, setCatalogDocuments] = useState<DocumentRecord[]>([]);
  const [catalogFilterFormat, setCatalogFilterFormat] = useState<string>('all');
  const [catalogFilterStatus, setCatalogFilterStatus] = useState<string>('all');
  const [catalogSearchText, setCatalogSearchText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [advancedTab, setAdvancedTab] = useState<'proposals' | 'snapshots' | 'transfers' | 'settings' | 'system' | 'help' | 'compiler'>('proposals');
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Document Reader Modal state
  const [readerOpen, setReaderOpen] = useState<boolean>(false);
  const [readerTarget, setReaderTarget] = useState<string | null>(null);
  const [readerPassageId, setReaderPassageId] = useState<string | undefined>(undefined);
  const [readerExpectedRevision, setReaderExpectedRevision] = useState<number | undefined>(undefined);
  const [readerExpectedHash, setReaderExpectedHash] = useState<string | undefined>(undefined);
  const [readerQuery, setReaderQuery] = useState<string | undefined>(undefined);
  const [useSemanticSearch, setUseSemanticSearch] = useState<boolean>(true);
  const [searchDegraded, setSearchDegraded] = useState<boolean>(false);
  const [searchProvider, setSearchProvider] = useState<'local' | 'openai'>('local');
  const [localServerHealthy, setLocalServerHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<{ provider: 'local' | 'openai'; degraded: boolean; is_local: boolean }>('search_mode_status', (e) => {
      setSearchDegraded(e.payload.degraded);
      setSearchProvider(e.payload.provider);
    }).then((u) => {
      unlisten = u;
    }).catch((err) => {
      // Errore visibile: un listener negato dal sistema di permessi lascerebbe il banner muto.
      console.error('[LIMEN] listen(search_mode_status) non registrato:', err);
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (currentTab === 'search' && vaultPath && isTauriEnv) {
      void aiIpc
        .embeddingsGetProvider(vaultPath)
        .then((p) => setSearchProvider(p.provider))
        .catch(() => {});
      void aiIpc
        .localServerStatus()
        .then((s) => setLocalServerHealthy(s.running && s.healthy))
        .catch(() => {});
    }
  }, [currentTab, vaultPath, isTauriEnv, searchRevision]);

  const openReader = (target: string, passageId?: string, query?: string, revision?: number, hash?: string) => {
    setReaderTarget(target);
    setReaderPassageId(passageId);
    setReaderExpectedRevision(revision);
    setReaderExpectedHash(hash);
    setReaderQuery(query);
    setReaderOpen(true);
  };
  const busy = useRef(false);
  const generation = useRef(0);
  const ipc = useRef(createVaultIpc(invoke, () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)).current;
  useEffect(() => () => { generation.current++; }, []);
  const begin = () => { if (busy.current) return null; busy.current=true; setIsProcessing(true); return ++generation.current; };
  const finish = (ticket:number) => { if(ticket===generation.current) {busy.current=false;setIsProcessing(false);} };


  // Detect Tauri Environment
  useEffect(() => {
    let cancelled = false;
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    setIsTauriEnv(isTauri);

    if (isTauri) {
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
  const refreshCatalog = async (target: string, ticket: number) => {
    try {
      const summary = await ipc.syncCatalog(target);
      const list = await ipc.listCatalogDocuments(target, {
        limit: 500,
        format: catalogFilterFormat !== 'all' ? catalogFilterFormat : undefined,
        status: catalogFilterStatus !== 'all' ? catalogFilterStatus : undefined,
        filter: catalogSearchText.trim() || undefined,
      });
      if (ticket !== generation.current) return;
      setCatalogSummary(summary);
      setCatalogDocuments(list.documents);
      if (summary.totalRawSources > 0 || summary.totalDocuments > 0) {
        setSourceCount(summary.totalRawSources || summary.totalDocuments);
      }
    } catch (e) {
      console.error('refreshCatalog error:', e);
    }
  };

  const handleUploadDocuments = async () => {
    if (!vaultPath) return;
    const ticket = begin();
    if (ticket === null) return;
    setActionError(null);
    try {
      await ipc.automationChooseFiles(vaultPath);
      await ipc.processPendingExtractions(vaultPath);
      await refreshCatalog(vaultPath, ticket);
      await refreshCompiler(vaultPath, ticket);
      setSearchRevision((r) => r + 1);
    } catch (err) {
      setActionError(`Caricamento non riuscito: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      finish(ticket);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!vaultPath) return;
    const ticket = begin();
    if (ticket === null) return;
    setActionError(null);
    setRestoreMessage(null);
    try {
      const rep = await ipc.restoreSnapshot(vaultPath, snapshotId);
      setRestoreMessage(`Copia ripristinata con successo in: ${rep.destination_path} (${rep.files_restored} file verificati SHA-256)`);
    } catch (err) {
      setActionError(`Ripristino non riuscito: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      finish(ticket);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!vaultPath) return;
    const files = Array.from(e.dataTransfer.files);
    const filePaths: string[] = [];
    for (const f of files) {
      const path = (f as any).path;
      if (path) filePaths.push(path);
    }
    if (filePaths.length > 0) {
      const ticket = begin();
      if (ticket === null) return;
      try {
        await ipc.automationImportFiles(vaultPath, filePaths);
        await ipc.processPendingExtractions(vaultPath);
        await refreshCatalog(vaultPath, ticket);
        await refreshCompiler(vaultPath, ticket);
        setSearchRevision((r) => r + 1);
      } catch (err) {
        setActionError(`Errore durante il caricamento: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        finish(ticket);
      }
    } else {
      await handleUploadDocuments();
    }
  };

  const refreshCompiler = async (target:string,ticket:number) => {
    try {
      const sources=await ipc.listRawSources(target);
      const proposals=await ipc.listProposals(target);
      if(ticket!==generation.current)return;
      setRawSourcesList(sources);
      setProposalsList(proposals);setProposalCount(proposals.length);
    }catch(e){if(ticket===generation.current){setRawSourcesList([]);setProposalsList([]);setActionError(`Aggiornamento delle fonti non riuscito: ${String(e)}`);}}
  };
  const handleRecheck = async () => {
    if(!vaultPath)return;const ticket=begin();if(ticket===null)return;setActionError(null);
    try{
      await refreshSnapshotsAndIntegrity(vaultPath,ticket);
      await refreshCompiler(vaultPath,ticket);
      await refreshCatalog(vaultPath,ticket);
    }finally{finish(ticket);}
  };

  const handleBrowseFolder = async (): Promise<string | null> => {
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Serve l’applicazione nativa LIMEN. Questa è un’anteprima nel browser.');
      return null;
    }
    try {
      const selected = await ipc.selectVaultFolder();
      if (selected) {
        const normalized = selected.replace(/\//g, '\\');
        setCustomPathInput(normalized);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('limen_last_vault_path', normalized);
          } catch {}
        }
        return normalized;
      }
      return null;
    } catch (err) {
      setActionError(typeof err === 'string' ? err : (err as Error).message);
      return null;
    }
  };

  const handleCreateVault = async () => {
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Serve l’applicazione nativa LIMEN. Questa è un’anteprima nel browser.');
      return;
    }

    let target = customPathInput.trim();
    if (!target) {
      const selected = await handleBrowseFolder();
      if (!selected) return; // User cancelled
      target = selected;
    }

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
        const normalized = res.path.replace(/\//g, '\\');
        setCustomPathInput(normalized);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('limen_last_vault_path', normalized);
          } catch {}
        }
        await refreshSnapshotsAndIntegrity(res.path,ticket);
        await refreshCompiler(res.path,ticket);
        await refreshCatalog(res.path,ticket);
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

    let target = customPathInput.trim();
    if (!target) {
      const selected = await handleBrowseFolder();
      if (!selected) return; // User cancelled
      target = selected;
    }

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
        const normalized = res.status.path.replace(/\//g, '\\');
        setCustomPathInput(normalized);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('limen_last_vault_path', normalized);
          } catch {}
        }
        await refreshSnapshotsAndIntegrity(res.status.path,ticket);
        await refreshCompiler(res.status.path,ticket);
        await refreshCatalog(res.status.path,ticket);
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
    if(!vaultPath||!isTauriEnv||(currentTab!=='search' && currentTab!=='ask')){setSearchLoading(false);return;}
    setSearchLoading(true);setActionError(null);
    const timer=setTimeout(()=>{
      void searchRequest.run(async()=>{
        const status=await ipc.getSearchIndexStatus(vaultPath);
        const results=status.state==='ready'?await ipc.searchVaultHybrid(vaultPath,{term:searchTerm.trim()||undefined,category:searchCategory||undefined,client:searchClient.trim()||undefined,project:searchProject.trim()||undefined,tags:searchTags.split(',').map(t=>t.trim()).filter(Boolean),status:searchStatusFilter||undefined}, undefined, useSemanticSearch):[];
        return {status,results};
      },value=>{setSearchIndexStatus(value.status);setSearchResults(value.results);setSearchLoading(false);},error=>{setActionError(`Ricerca non riuscita: ${String(error)}`);setSearchLoading(false);});
    },180);
    return ()=>{clearTimeout(timer);searchRequest.invalidate();};
  },[vaultPath,isTauriEnv,currentTab,searchTerm,searchCategory,searchClient,searchProject,searchTags,searchStatusFilter,searchRevision,searchRequest,useSemanticSearch,ipc]);

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
                {vaultLoaded && vaultName ? vaultName : 'Nessun Vault'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--limen-text-muted)', fontWeight: 500 }}>
                LIMEN Vault v3 {isTauriEnv ? '(app nativa)' : '(anteprima browser)'}
              </div>
            </div>
          </div>

          {/* GLOBAL CARICA DOCUMENTI BUTTON */}
          {vaultPath && vaultLoaded && (
            <div style={{ marginBottom: 14 }}>
              <button
                id="btn-upload-documents-global"
                onClick={handleUploadDocuments}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#c8ff00',
                  color: '#0a0c10',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  width: '100%',
                  boxShadow: '0 2px 8px rgba(200, 255, 0, 0.25)',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.02em',
                }}
              >
                <Upload size={15} />
                <span>{isProcessing ? 'CARICAMENTO…' : 'CARICA DOCUMENTI'}</span>
              </button>
            </div>
          )}

          {/* MAIN 3-AREA NAV LIST */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              {
                id: 'ask',
                label: 'Chiedi',
                icon: <Sparkles size={16} color={currentTab === 'ask' || currentTab === 'search' ? '#0f172a' : '#64748b'} />,
                active: currentTab === 'ask' || currentTab === 'search',
                badge: undefined,
              },
              {
                id: 'documents',
                label: 'Documenti',
                icon: <FolderArchive size={16} color={currentTab === 'documents' || currentTab === 'sources' ? '#0f172a' : '#64748b'} />,
                active: currentTab === 'documents' || currentTab === 'sources',
                badge: String(catalogSummary?.totalRawSources ?? sourceCount),
              },
              {
                id: 'memory',
                label: 'Memoria',
                icon: <BookOpen size={16} color={currentTab === 'memory' || currentTab === 'knowledge' ? '#0f172a' : '#64748b'} />,
                active: currentTab === 'memory' || currentTab === 'knowledge',
                badge: String(pageCount),
              },
            ].map((item) => {
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id as NavTab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: item.active ? '1px solid #cbd5e1' : '1px solid transparent',
                    backgroundColor: item.active ? '#ffffff' : 'transparent',
                    color: item.active ? '#0f172a' : '#475569',
                    boxShadow: item.active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    fontWeight: item.active ? 600 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 10, backgroundColor: item.active ? '#e2e8f0' : '#f1f5f9', color: '#475569' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div style={{ margin: '8px 0', borderBottom: '1px solid var(--limen-border-light)' }} />

            {/* AVANZATE NAVIGATION */}
            <button
              onClick={() => setCurrentTab('advanced')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 6,
                border: (currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) ? '1px solid #cbd5e1' : '1px solid transparent',
                backgroundColor: (currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) ? '#ffffff' : 'transparent',
                color: (currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) ? '#0f172a' : '#64748b',
                boxShadow: (currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                fontWeight: (currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) ? 600 : 500,
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sliders size={16} />
                <span>Avanzate</span>
              </div>
            </button>
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
              {(currentTab === 'ask' || currentTab === 'search') && 'Chiedi al Vault'}
              {(currentTab === 'documents' || currentTab === 'sources') && 'Documenti Aziendali'}
              {(currentTab === 'memory' || currentTab === 'knowledge') && 'Memoria Aziendale'}
              {(currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'help', 'settings'].includes(currentTab)) && 'Avanzate e Manutenzione'}
            </span>
            {vaultPath && (
              <span style={{ fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                {vaultPath.split(/[/\\]/).filter(Boolean).pop()}
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
          currentTab === 'help' ? (
            <HelpPanel
              vaultPath={vaultPath}
              onOpenObsidian={handleOpenObsidian}
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
          ) : (
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
              Benvenuto in LIMEN Vault v3
            </div>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 28px 0' }}>
              Un ambiente di conoscenza locale e indipendente. Crea un nuovo Vault compatibile con Obsidian oppure apri la cartella di un Vault esistente.
            </p>

            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Percorso del Vault (cartella locale)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customPathInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\//g, '\\');
                    setCustomPathInput(val);
                    if (typeof localStorage !== 'undefined') {
                      try {
                        localStorage.setItem('limen_last_vault_path', val);
                      } catch {}
                    }
                  }}
                  placeholder="Scegli la cartella del vault"
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  disabled={isProcessing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <FolderOpen size={16} />
                  <span>Sfoglia…</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleCreateVault}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isProcessing ? '#94a3b8' : '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? <Loader2 size={16} className="spin" /> : <PlusCircle size={16} />}
                <span>CREA NUOVO VAULT</span>
              </button>

              <button
                type="button"
                onClick={handleOpenExistingVault}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#ffffff',
                  color: isProcessing ? '#94a3b8' : '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? <Loader2 size={16} className="spin" /> : <FolderOpen size={16} />}
                <span>APRI VAULT ESISTENTE</span>
              </button>
            </div>

            {/* VALIDATION ERRORS IN WELCOME CARD */}
            {validationErrors.length > 0 && (
              <div style={{ marginTop: 24, textAlign: 'left', backgroundColor: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                  Errori di validazione del Vault ({validationErrors.length})
                </div>
                <div style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 8 }}>
                  Trovate {validationErrors.length} note con errori di schema o struttura.
                </div>
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', cursor: 'pointer' }}>
                    Consulta il dettaglio tecnico…
                  </summary>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 12, color: '#b91c1c', maxHeight: 180, overflowY: 'auto' }}>
                    {validationErrors.map((err, i) => (
                      <li key={i}>{<MessageIt value={err}/>}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
          )
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

            {/* 1. CHIEDI (RICERCA IBRIDA + DOMANDE AI CON CITAZIONI) */}
            {(currentTab === 'ask' || currentTab === 'search') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* UNIFIED SEARCH & QUESTION BAR */}
                <div className="limen-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                        Cerca nel Vault & Chiedi all’AI
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Cerca nei passaggi estratti dei documenti e nelle note aziendali con ricerca ibrida locale, oppure invia la domanda a OpenAI con citazioni verificate.
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
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isProcessing || !vaultPath ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isProcessing ? <Loader2 size={13} className="spin" /> : <RotateCw size={13} />}
                      <span>Aggiorna indice</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input
                        type="text"
                        placeholder="Cerca parole chiave, contratti, clienti, passaggi di documenti..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px 10px 38px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <select
                      value={searchCategory}
                      onChange={(e) => setSearchCategory(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                      }}
                    >
                      <option value="">Tutte le categorie</option>
                      <option value="client">Clienti (01_CLIENTS)</option>
                      <option value="project">Progetti (02_PROJECTS)</option>
                      <option value="brand">Marchi (03_BRANDS)</option>
                      <option value="source">Originali (20_RAW_SOURCES)</option>
                      <option value="approved_output">Approvati (10_APPROVED_OUTPUTS)</option>
                      <option value="proposal">Proposte (90_PROPOSALS)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      aria-label="Filtra per cliente"
                      placeholder="Filtro cliente..."
                      value={searchClient}
                      onChange={(e) => setSearchClient(e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
                    />
                    <input
                      aria-label="Filtra per progetto"
                      placeholder="Filtro progetto..."
                      value={searchProject}
                      onChange={(e) => setSearchProject(e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f1f5f9', fontSize: 11, cursor: 'pointer' }}
                      >
                        Cancella ricerca
                      </button>
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer', marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={useSemanticSearch}
                        onChange={(e) => setUseSemanticSearch(e.target.checked)}
                      />
                      <span>Ricerca Ibrida (Semantica + Lessicale)</span>
                      {useSemanticSearch && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor:
                              searchProvider === 'local'
                                ? searchDegraded || localServerHealthy === false
                                  ? '#fee2e2'
                                  : '#dcfce7'
                                : '#e0e7ff',
                            color:
                              searchProvider === 'local'
                                ? searchDegraded || localServerHealthy === false
                                  ? '#991b1b'
                                  : '#166534'
                                : '#3730a3',
                          }}
                        >
                          {searchProvider === 'local'
                            ? searchDegraded || localServerHealthy === false
                              ? '⚠️ RAG LOCALE SPENTO (SOLO LESSICALE)'
                              : '🟢 RAG 100% LOCALE'
                            : '🌐 OPENAI (IN RETE)'}
                        </span>
                      )}
                    </label>
                  </div>

                  {searchLoading && <p style={{ fontSize: 12, color: '#64748b', margin: '10px 0 0 0' }}>Ricerca in corso…</p>}
                </div>

                {/* DEGRADED MODE WARNING BANNER IF LOCAL SERVICE DOWN */}
                {useSemanticSearch && searchDegraded && (
                  <div
                    role="alert"
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fef3c7',
                      color: '#92400e',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>
                      <strong>Modalità degradata (solo ricerca lessicale):</strong> il servizio semantico locale non è
                      attivo o non ha risposto. I risultati sono calcolati esclusivamente tramite indice lessicale. Nessun
                      dato è uscito dal Mac.
                    </div>
                  </div>
                )}

                {/* SEARCH RESULTS PREVIEW IF QUERY PRESENT */}
                {searchTerm.trim() && searchResults.length > 0 && (
                  <div className="limen-card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                      {searchResults.length} risultati trovati per "{searchTerm}":
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {searchResults.slice(0, 5).map((item) => (
                        <div
                          key={item.relative_path}
                          onClick={() => openReader(item.id || item.relative_path, item.matching_passage_id, searchTerm, undefined, item.sha256)}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{item.title}</span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {item.matching_locator && (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, backgroundColor: 'rgba(200,255,0,0.2)', color: '#4d7c0f', border: '1px solid rgba(200,255,0,0.4)' }}>
                                  {item.matching_locator}
                                </span>
                              )}
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#334155' }}>
                                {labelIt(item.category)}
                              </span>
                            </div>
                          </div>
                          {item.snippet && (
                            <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', margin: '4px 0' }}>
                              "{item.snippet}"
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{item.relative_path}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#0284c7' }}>Apri nel lettore →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Q&A COMPONENT WITH MODEL PICKER & PASSAGE CITATIONS */}
                <AiPanel
                  key={vaultPath}
                  vaultPath={vaultPath!}
                  onOpenDocument={(req) => openReader(req.documentId, req.passageId, undefined, req.revision, req.sha256)}
                />
              </div>
            )}

            {/* 2. DOCUMENTI (INVENTARIO COMPLETO ORIGINALI + ESTRAZIONE + CARICAMENTO LIME) */}
            {(currentTab === 'documents' || currentTab === 'sources') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* TOP STATS BANNER */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    borderRadius: 12,
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>Documenti Aziendali</h2>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                      Tutti i file originali acquisiti in <code>20_RAW_SOURCES</code> con testo estratto e indicizzato per la ricerca.
                    </p>
                    <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12 }}>
                      <span style={{ color: '#c8ff00', fontWeight: 600 }}>
                        {catalogSummary?.totalRawSources ?? catalogDocuments.length} originali acquisiti
                      </span>
                      <span style={{ color: '#86efac' }}>
                        {catalogSummary?.readyDocuments ?? 0} pronti per la consultazione
                      </span>
                      {catalogSummary && catalogSummary.processingDocuments > 0 && (
                        <span style={{ color: '#fde047' }}>
                          {catalogSummary.processingDocuments} in estrazione
                        </span>
                      )}
                      <span style={{ color: '#cbd5e1' }}>
                        {catalogSummary?.totalPassages ?? 0} passaggi estratti
                      </span>
                    </div>
                  </div>
                  <button
                    id="btn-upload-documents-view"
                    onClick={handleUploadDocuments}
                    disabled={isProcessing}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#c8ff00',
                      color: '#0a0c10',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 10px rgba(200, 255, 0, 0.3)',
                    }}
                  >
                    <Upload size={16} />
                    <span>{isProcessing ? 'CARICAMENTO…' : 'CARICA DOCUMENTI'}</span>
                  </button>
                </div>

                {/* DRAG AND DROP ZONE */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleUploadDocuments}
                  style={{
                    border: `2px dashed ${isDragging ? '#c8ff00' : '#cbd5e1'}`,
                    backgroundColor: isDragging ? 'rgba(200, 255, 0, 0.08)' : '#f8fafc',
                    borderRadius: 10,
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Upload size={28} style={{ margin: '0 auto 8px', color: isDragging ? '#c8ff00' : '#64748b' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    Trascina qui i tuoi documenti o clicca per selezionare dal Mac
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    PDF, Word (.docx), Excel (.xlsx), presentazioni, scansioni, note e testi. Massimo 32 MB per file.
                  </div>
                </div>

                {/* FILTERS TOOLBAR */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: 'Tutti i formati' },
                      { id: 'pdf', label: 'PDF' },
                      { id: 'docx', label: 'Word (DOCX)' },
                      { id: 'xlsx', label: 'Excel / Fogli' },
                      { id: 'txt', label: 'Testo e Note' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setCatalogFilterFormat(f.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid',
                          borderColor: catalogFilterFormat === f.id ? '#0f172a' : '#cbd5e1',
                          backgroundColor: catalogFilterFormat === f.id ? '#0f172a' : '#ffffff',
                          color: catalogFilterFormat === f.id ? '#ffffff' : '#334155',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Filtra per nome file..."
                    value={catalogSearchText}
                    onChange={(e) => setCatalogSearchText(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      width: 220,
                    }}
                  />
                </div>

                {/* DOCUMENTS TABLE */}
                <div className="limen-card" style={{ padding: 20 }}>
                  {catalogDocuments.length === 0 ? (
                    <EmptyState
                      title="Nessun documento trovato"
                      description={catalogSearchText || catalogFilterFormat !== 'all' ? 'Nessun file corrisponde ai filtri selezionati.' : 'Nessun file presente in 20_RAW_SOURCES. Clicca su CARICA DOCUMENTI per iniziare.'}
                      icon={<FolderArchive size={32} />}
                    />
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Documento</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Formato</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Dimensione</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Stato estrazione</th>
                          <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalogDocuments.map((doc) => {
                          const statusLabel =
                            doc.extractionStatus === 'ready'
                              ? 'Pronto per la ricerca'
                              : doc.extractionStatus === 'processing'
                              ? 'In estrazione'
                              : doc.extractionStatus === 'unsupported'
                              ? 'Non supportato'
                              : doc.extractionStatus === 'protected'
                              ? 'Protetto da password'
                              : 'In attesa';
                          const statusColor =
                            doc.extractionStatus === 'ready'
                              ? '#059669'
                              : doc.extractionStatus === 'processing'
                              ? '#d97706'
                              : doc.extractionStatus === 'failed'
                              ? '#dc2626'
                              : '#64748b';

                          return (
                            <tr key={doc.documentId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{doc.fileName}</div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{doc.originalPath}</div>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                <span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#f1f5f9', color: '#334155' }}>
                                  {doc.extension || 'file'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#475569' }}>
                                {(doc.fileSize / 1024).toFixed(1)} KB
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                                  {statusLabel}
                                </span>
                                {doc.passages && doc.passages.length > 0 && (
                                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                    {doc.passages.length} passaggi estratti
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button
                                    onClick={() => openReader(doc.documentId, undefined, undefined, doc.revision, doc.contentHash)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#f8fafc',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Leggi nel Vault
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!vaultPath) return;
                                      try {
                                        await ipc.openOriginal(vaultPath, doc.documentId);
                                      } catch (err) {
                                        setActionError(String(err));
                                      }
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#ffffff',
                                      fontSize: 11,
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Apri originale
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!vaultPath) return;
                                      try {
                                        await ipc.revealInFinder(vaultPath, doc.documentId);
                                      } catch (err) {
                                        setActionError(String(err));
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 4,
                                      border: '1px solid #e2e8f0',
                                      backgroundColor: '#f8fafc',
                                      fontSize: 11,
                                      cursor: 'pointer',
                                    }}
                                    title="Mostra nel Finder"
                                  >
                                    Finder
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* 3. MEMORIA (CATEGORIE AZIENDALI 01-10 + NOTE CONDIVISE) */}
            {(currentTab === 'memory' || currentTab === 'knowledge') && (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                  {['clients', 'projects', 'brands', 'positioning', 'packaging', 'methods', 'case_studies', 'research', 'competitors', 'approved_outputs'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: selectedCategory === cat ? '#0f172a' : '#f1f5f9',
                        color: selectedCategory === cat ? '#ffffff' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {cat === 'all' ? 'Tutte le note' : labelIt(cat)}
                    </button>
                  ))}
                </div>

                <KnowledgePanel vaultPath={vaultPath!} category={selectedCategory} />
              </div>
            )}

            {/* 4. AVANZATE (PROPOSTE, SNAPSHOT & RECUPERO, TRASFERIMENTI, IMPOSTAZIONI, COMPILATORE, SISTEMA, GUIDA) */}
            {(currentTab === 'advanced' || ['proposals', 'outputs', 'snapshots', 'transfers', 'system', 'settings', 'help'].includes(currentTab)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* SEGMENTED SUB-NAVIGATION */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                  {[
                    { id: 'proposals', label: 'Bozze e Proposte' },
                    { id: 'snapshots', label: 'Copie locali e Ripristino' },
                    { id: 'transfers', label: 'Trasferimenti' },
                    { id: 'settings', label: 'Collegamenti AI & MCP' },
                    { id: 'compiler', label: 'Compilatore manuale' },
                    { id: 'system', label: 'Stato di Sistema' },
                    { id: 'help', label: 'Guida Vault' },
                  ].map((sub) => {
                    const active = (advancedTab === sub.id) || (currentTab === sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setAdvancedTab(sub.id as any);
                          setCurrentTab('advanced');
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
                          backgroundColor: active ? '#0f172a' : '#ffffff',
                          color: active ? '#ffffff' : '#334155',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {/* SUBTAB: PROPOSALS */}
                {(advancedTab === 'proposals' || currentTab === 'proposals' || currentTab === 'outputs') && vaultPath && (
                  <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                      <button
                        onClick={() => setCurrentTab('outputs')}
                        style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: currentTab === 'outputs' ? '#0f172a' : '#f1f5f9', color: currentTab === 'outputs' ? '#fff' : '#334155', fontSize: 12, border: 'none', cursor: 'pointer' }}
                      >
                        Risposte AI salvate (80_AI_OUTPUTS)
                      </button>
                      <button
                        onClick={() => setCurrentTab('proposals')}
                        style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: currentTab === 'proposals' || currentTab === 'advanced' ? '#0f172a' : '#f1f5f9', color: currentTab === 'proposals' || currentTab === 'advanced' ? '#fff' : '#334155', fontSize: 12, border: 'none', cursor: 'pointer' }}
                      >
                        Proposte manuali (90_PROPOSALS)
                      </button>
                    </div>
                    <ProposalPanel key={vaultPath + (currentTab === 'outputs' ? 'outputs' : 'proposals')} vaultPath={vaultPath} kind={currentTab === 'outputs' ? 'output' : 'proposal'} />
                  </div>
                )}

                {/* SUBTAB: SNAPSHOTS & RESTORE */}
                {(advancedTab === 'snapshots' || currentTab === 'snapshots') && (
                  <div className="limen-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Copie locali e Ripristino guidato</h3>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          Copie immutabili verificate SHA-256 in <code>00_SYSTEM/SNAPSHOTS/</code>. Il ripristino ricrea il Vault in una cartella separata senza sovrascritture distruttive.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Nota facoltativa..."
                          value={snapshotNoteInput}
                          onChange={(e) => setSnapshotNoteInput(e.target.value)}
                          disabled={isProcessing}
                          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, width: 200 }}
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

                    {restoreMessage && (
                      <div style={{ marginBottom: 16, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                        {restoreMessage}
                      </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>ID copia</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Data</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Nota</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>File</th>
                          <th style={{ padding: '8px 12px', color: '#475569' }}>Integrità SHA-256</th>
                          <th style={{ padding: '8px 12px', color: '#475569', textAlign: 'right' }}>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshotsList.map((snap) => (
                          <tr key={snap.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{snap.id}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {snap.created_at ? new Date(snap.created_at).toLocaleString("it-IT") : 'N/A'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>{snap.note || 'Copia locale'}</td>
                            <td style={{ padding: '10px 12px', color: '#475569' }}>{snap.manifest_file_count} file</td>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusBadge
                                status={snap.integrity_status === 'valid' ? 'READY' : 'INVALID'}
                                label={snap.integrity_status === 'valid' ? 'Verificata (SHA-256)' : 'Incompleta'}
                              />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleRestoreSnapshot(snap.id)}
                                disabled={isProcessing || snap.integrity_status !== 'valid'}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 4,
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: snap.integrity_status === 'valid' ? 'pointer' : 'not-allowed',
                                }}
                              >
                                RIPRISTINA IN CARTELLA SEPARATA
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SUBTAB: TRANSFERS */}
                {(advancedTab === 'transfers' || currentTab === 'transfers') && <SyncPanel vaultPath={vaultPath!} />}

                {/* SUBTAB: SETTINGS */}
                {(advancedTab === 'settings' || currentTab === 'settings') && (
                  <>
                    <AiSettings key={vaultPath} vaultPath={vaultPath!} />
                    <div className="limen-card" style={{ padding: 24, maxWidth: 640 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Impostazioni del Vault</h3>
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
                  </>
                )}

                {/* SUBTAB: COMPILER */}
                {advancedTab === 'compiler' && (
                  <div className="limen-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Compilatore Markdown Manuale</h3>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Compila file di testo e Markdown in bozze <code>90_PROPOSALS/</code></div>
                      </div>
                      <button onClick={handleBatchCompile} disabled={isProcessing || !vaultPath} style={{ padding: '8px 14px', borderRadius: 6, backgroundColor: '#0f172a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        COMPILA FONTI TESTO
                      </button>
                    </div>
                  </div>
                )}

                {/* SUBTAB: SYSTEM */}
                {(advancedTab === 'system' || currentTab === 'system') && (
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
                          <td style={{ padding: '10px 0', color: '#047857', fontWeight: 600 }}>Attivo, con verifica SHA-256</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 0', color: '#64748b' }}>Ambiente di esecuzione</td>
                          <td style={{ padding: '10px 0', color: '#0f172a', fontWeight: 600 }}>{isTauriEnv ? 'Applicazione nativa macOS' : 'Anteprima nel browser'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SUBTAB: HELP */}
                {(advancedTab === 'help' || currentTab === 'help') && (
                  <HelpPanel
                    vaultPath={vaultPath}
                    onOpenObsidian={handleOpenObsidian}
                    onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
      </div>

      <DocumentReaderModal
        isOpen={readerOpen}
        onClose={() => {
          setReaderOpen(false);
          setReaderTarget(null);
          setReaderPassageId(undefined);
          setReaderExpectedRevision(undefined);
          setReaderExpectedHash(undefined);
          setReaderQuery(undefined);
        }}
        vaultPath={vaultPath || ''}
        documentId={readerTarget}
        initialPassageId={readerPassageId}
        expectedRevision={readerExpectedRevision}
        expectedHash={readerExpectedHash}
        highlightQuery={readerQuery}
        ipc={ipc}
      />
    </div>
  );
}
