import {KnowledgePanel} from './KnowledgePanel';
import {ProposalPanel} from './ProposalPanel';
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
      setActionError(`Integrity refresh failed: ${e instanceof Error?e.message:String(e)}`);
    }
  };
  const refreshCompiler = async (target:string,ticket:number) => {
    try {
      const sources=await ipc.listRawSources(target);
      const proposals=await ipc.listProposals(target);
      if(ticket!==generation.current)return;
      setRawSourcesList(sources);setSourceCount(sources.length);
      setProposalsList(proposals);setProposalCount(proposals.length);
    }catch(e){if(ticket===generation.current){setRawSourcesList([]);setProposalsList([]);setActionError(`Compiler refresh failed: ${String(e)}`);}}
  };
  const handleRecheck = async () => {
    if(!vaultPath)return;const ticket=begin();if(ticket===null)return;setActionError(null);
    try{await refreshSnapshotsAndIntegrity(vaultPath,ticket);await refreshCompiler(vaultPath,ticket);}finally{finish(ticket);}
  };

  const handleCreateVault = async () => {
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Native Tauri IPC runtime required. Operating in web browser preview mode.');
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
      setActionError('Native Tauri IPC runtime required. Operating in web browser preview mode.');
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
      setActionError('Native Tauri IPC runtime required to create local snapshots.');
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
      setActionError(`Snapshot creation failed: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleCompileSingleSource = async (relPath: string) => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Native Tauri IPC runtime required to compile raw sources.');
      return;
    }
    const ticket = begin(); if (ticket === null) return;
    try {
      const res = await ipc.compileSource(vaultPath, relPath);
      if (ticket !== generation.current) return;
      if (res.status === 'error' || res.status === 'unsupported') {
        setActionError(`Compilation failed for ${relPath}: ${res.error}`);
      }
      await refreshSnapshotsAndIntegrity(vaultPath,ticket);
      await refreshCompiler(vaultPath,ticket);
    } catch (err) {
      if (ticket !== generation.current) return;
      setActionError(`Compile source failed: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleBatchCompile = async () => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Native Tauri IPC runtime required to batch compile raw sources.');
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
      setActionError(`Batch compile failed: ${typeof err === 'string' ? err : (err as Error).message}`);
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
      },value=>{setSearchIndexStatus(value.status);setSearchResults(value.results);setSearchLoading(false);},error=>{setActionError(`Search failed: ${String(error)}`);setSearchLoading(false);});
    },180);
    return ()=>{clearTimeout(timer);searchRequest.invalidate();};
  },[vaultPath,isTauriEnv,currentTab,searchTerm,searchCategory,searchClient,searchProject,searchTags,searchStatusFilter,searchRevision,searchRequest,ipc]);

  const handleReindexSearch = async () => {
    if (!vaultPath) return;
    setActionError(null);
    if (!isTauriEnv) {
      setActionError('Native Tauri IPC runtime required for search indexing.');
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
      setActionError(`Search indexing failed: ${typeof err === 'string' ? err : (err as Error).message}`);
    } finally {
      finish(ticket);
    }
  };

  const handleOpenObsidian = async () => {
    if (!vaultPath) return;
    setActionError(null);

    if (!isTauriEnv) {
      setActionError('Native Tauri IPC runtime required to launch Obsidian application.');
      return;
    }

    try {
      await ipc.obsidian(vaultPath);
    } catch (err) {
      setActionError(`Obsidian launch failed: ${typeof err === 'string' ? err : (err as Error).message}`);
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
                Desktop v0.1.0 {isTauriEnv ? '(Tauri Native)' : '(Browser Web Mode)'}
              </div>
            </div>
          </div>

          {/* MAIN NAV LIST */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { id: 'home', label: 'Home', icon: <Home size={16} /> },
              { id: 'ask', label: 'Ask Knowledge', icon: <MessageSquare size={16} />, badge: 'M6' },
              { id: 'knowledge', label: 'Knowledge', icon: <BookOpen size={16} /> },
              { id: 'sources', label: 'Sources', icon: <FolderArchive size={16} /> },
              { id: 'search', label: 'Search', icon: <Search size={16} /> },
              { id: 'outputs', label: 'AI Outputs', icon: <Sparkles size={16} /> },
              { id: 'proposals', label: 'Proposals', icon: <FileCheck size={16} /> },
              { id: 'snapshots', label: 'Snapshots', icon: <History size={16} />, badge: 'M3' },
              { id: 'system', label: 'System', icon: <Activity size={16} /> },
              { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
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
            <span>Open in Obsidian</span>
          </button>
        </div>
      </aside>

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
              <strong>Web Browser Preview Mode:</strong> Native Tauri IPC runtime is required for local filesystem, snapshot hashing, and Obsidian operations. Native file operations are disabled in browser view.
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
            <strong>Error:</strong> {actionError}
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
              Welcome to LIMEN Vault
            </div>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 28px 0' }}>
              Standalone, local-first knowledge environment. Get started by instantiating a new Obsidian-compatible Vault or opening an existing directory.
            </p>

            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                Target Vault Path (Local Directory)
              </label>
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                placeholder="e.g. /Users/cesare/Documents/MY_VAULT"
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
                <span>CREATE NEW VAULT</span>
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
                <span>OPEN EXISTING VAULT</span>
              </button>
            </div>

            {/* VALIDATION ERRORS IN WELCOME CARD */}
            {validationErrors.length > 0 && (
              <div style={{ marginTop: 24, textAlign: 'left', backgroundColor: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
                  Vault Validation Failures ({validationErrors.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#b91c1c' }}>
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
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
                  <MetricCard title="Markdown Files" value={pageCount} subtitle="All Vault Markdown files" />
                  <MetricCard title="Raw Sources" value={sourceCount} subtitle="Read-only documents" />
                  <MetricCard title="Proposal Files" value={proposalCount} subtitle="Stored draft revisions" />
                  <MetricCard
                    title="SHA-256 Integrity"
                    value={integrityReport?.is_integrity_valid ? 'VERIFIED' : integrityReport?.errors.length ? 'UNVERIFIED' : integrityReport ? 'DISCREPANCY' : 'UNVERIFIED'}
                    subtitle={
                      integrityReport?.is_integrity_valid
                        ? `All ${integrityReport.verified_files_count} files match SHA-256`
                        : integrityReport?.errors.length
                        ? 'Verification could not complete'
                        : integrityReport
                        ? `${integrityReport.modified_files.length} mod, ${integrityReport.missing_files.length} miss, ${integrityReport.added_files.length} add`
                        : 'Crypto hash unverified'
                    }
                  />
                </div>

                {/* SHA-256 DISCREPANCIES CARD IF ANY */}
                {integrityReport && !integrityReport.is_integrity_valid && integrityReport.errors.length === 0 && (
                  <div style={{ marginBottom: 24, backgroundColor: '#fffbe5', padding: 16, borderRadius: 8, border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', marginBottom: 8 }}>
                      SHA-256 Manifest Discrepancies Detected
                    </div>
                    {integrityReport.modified_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207', marginBottom: 4 }}>
                        <strong>Modified Files ({integrityReport.modified_files.length}):</strong> {integrityReport.modified_files.join(', ')}
                      </div>
                    )}
                    {integrityReport.missing_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207', marginBottom: 4 }}>
                        <strong>Missing Files ({integrityReport.missing_files.length}):</strong> {integrityReport.missing_files.join(', ')}
                      </div>
                    )}
                    {integrityReport.added_files.length > 0 && (
                      <div style={{ fontSize: 12, color: '#a16207' }}>
                        <strong>Unmanifested Added Files ({integrityReport.added_files.length}):</strong> {integrityReport.added_files.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                  <div className="limen-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Quick Navigation</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {['Clients', 'Projects', 'Brands', 'Positioning', 'Packaging', 'Methods', 'Case Studies', 'Research'].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCurrentTab('knowledge')}
                          style={{
                            padding: '14px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#0f172a',
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="limen-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0' }}>AI Integration</h3>
                    <button onClick={() => setCurrentTab('ask')} className="limen-btn-primary">Ask Knowledge</button>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 12 }}>
                      Preview local sources before sending a question to OpenAI. Configure credentials and read-only MCP in Settings.
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
                      {cat.replace('_', ' ')}
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
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Raw Sources (20_RAW_SOURCES)</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Immutable read-only raw files. Compiling extracts local text into candidate drafts in <code>90_PROPOSALS/</code> with <code>status: draft</code>.
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
                    <span>BATCH COMPILE ALL SOURCES</span>
                  </button>
                </div>

                <button onClick={async()=>{if(!vaultPath)return;const ticket=begin();if(ticket===null)return;setActionError(null);try{await refreshCompiler(vaultPath,ticket);}finally{finish(ticket);}}} disabled={isProcessing || !vaultPath} style={{padding:'8px 14px',marginBottom:16,border:'1px solid #cbd5e1',borderRadius:6,backgroundColor:'#ffffff',color:'#334155',fontSize:12,cursor:'pointer'}}>REFRESH SOURCES</button>

                {lastBatchReport && (
                  <div style={{ marginBottom: 20, backgroundColor: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                    <strong>Batch Compilation Summary:</strong> Compiled: {lastBatchReport.compiled_count} | Unchanged: {lastBatchReport.unchanged_count} | Unsupported: {lastBatchReport.unsupported_count} | Errors: {lastBatchReport.error_count}
                    {lastBatchReport.items.filter(item=>item.status==='error').map(item=><p key={item.source_relative_path} style={{color:'#b91c1c'}}>{item.source_relative_path}: {item.error}</p>)}
                  </div>
                )}

                {rawSourcesList.length === 0 ? (
                  <EmptyState
                    title="No raw document sources found"
                    description="Deposit raw markdown, text, or HTML documents into 20_RAW_SOURCES/ directory in your Vault."
                    icon={<FolderArchive size={32} />}
                  />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Source Path</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Extension</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Size</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Status</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawSourcesList.map((src) => (
                        <tr key={src.relative_path} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace', color: '#0f172a' }}>{src.relative_path}{src.first_compiled_at && <div style={{fontSize:10,fontWeight:400}}>First compiled: {src.first_compiled_at}</div>}{src.error && <div style={{color:'#b91c1c'}}>{src.error}</div>}</td>
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
                              {src.status}
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
                              Compile Draft
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
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Local Offline Full-Text Search</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Fast, local-first search across all Markdown notes, proposals, and metadata index (00_SYSTEM/SEARCH_INDEX.json).
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
                    <span>RE-INDEX SEARCH VAULT</span>
                  </button>
                </div>

                {/* SEARCH INPUT & FILTER BAR */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    placeholder="Search terms, titles, frontmatter, tags..."
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
                    <option value="">All Categories</option>
                    <option value="client">Clients</option>
                    <option value="project">Projects</option>
                    <option value="brand">Brands</option>
                    <option value="positioning">Positioning</option>
                    <option value="packaging">Packaging</option>
                    <option value="method">Methods</option>
                    <option value="case_study">Case Studies</option>
                    <option value="research">Research</option>
                    <option value="competitor">Competitors</option>
                    <option value="approved_output">Approved Outputs</option>
                    <option value="proposal">Proposals (90_PROPOSALS)</option>
                    <option value="ai_output">AI Outputs (80_AI_OUTPUTS)</option>
                  </select>
                </div>

                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
                  <input aria-label="Filter client" placeholder="Client" value={searchClient} onChange={e=>setSearchClient(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <input aria-label="Filter project" placeholder="Project" value={searchProject} onChange={e=>setSearchProject(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <input aria-label="Filter tags" placeholder="Tags, comma separated" value={searchTags} onChange={e=>setSearchTags(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6}} />
                  <select aria-label="Filter status" value={searchStatusFilter} onChange={e=>setSearchStatusFilter(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:6,background:'#fff'}}>
                    <option value="">All statuses</option><option value="approved">Approved</option><option value="draft">Draft</option><option value="review">Review</option><option value="archived">Archived</option>
                  </select>
                </div>
                {searchLoading && <p style={{fontSize:12,color:'#64748b'}}>Searching…</p>}
                {/* SEARCH INDEX STATUS BANNER */}
                {searchIndexStatus && (
                  <div style={{ marginBottom: 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                    <strong>Index Status:</strong> {searchIndexStatus.state==='ready'?`${searchIndexStatus.total_indexed} document(s) indexed at ${new Date(searchIndexStatus.last_indexed_at).toLocaleString()}. Re-index after adding or changing notes.`:'Index missing or outdated. Re-index to search.'}
                  </div>
                )}

                {/* SEARCH RESULTS LIST */}
                {searchResults.length === 0 ? (
                  <EmptyState
                    title="No matching search results"
                    description={searchTerm.trim() ? `No documents matched "${searchTerm}"` : 'Enter a search term or click RE-INDEX SEARCH VAULT to populate local search index.'}
                    icon={<Search size={32} />}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      Found {searchResults.length} matching document(s):
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
                              {item.category}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>
                              Score: {item.score}
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
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>Versioned Local Snapshots (Milestone M3)</h3>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      SHA-256 integrity verified local snapshots saved in <code>00_SYSTEM/SNAPSHOTS/</code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Optional snapshot note..."
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
                      <span>CREATE SNAPSHOT</span>
                    </button>
                  </div>
                </div>

                <button onClick={handleRecheck} disabled={isProcessing || !vaultPath} style={{ padding: '8px 14px', marginBottom: 16, border: '1px solid #cbd5e1', borderRadius: 6, backgroundColor: '#ffffff', color: '#334155', fontSize: 12, cursor: isProcessing ? 'not-allowed' : 'pointer' }}>RECHECK INTEGRITY</button>
                {snapshotsList.length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No versioned local snapshots found in <code>00_SYSTEM/SNAPSHOTS/</code>. Click <strong>CREATE SNAPSHOT</strong> to generate one.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Snapshot ID</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Created At</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Note / Description</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Files Count</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>SHA-256 Integrity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshotsList.map((snap) => (
                        <tr key={snap.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace', color: '#0f172a' }}>{snap.id}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {snap.created_at ? new Date(snap.created_at).toLocaleString() : 'N/A'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{snap.note || 'Versioned Local Snapshot'}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{snap.manifest_file_count} files</td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusBadge
                              status={snap.integrity_status === 'valid' ? 'READY' : 'INVALID'}
                              label={snap.integrity_status === 'valid' ? 'VERIFIED (SHA-256)' : snap.integrity_status === 'incomplete' ? 'INCOMPLETE' : 'CORRUPTED'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {currentTab === 'system' && (
              <div className="limen-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Local System Status</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Vault Root</td>
                      <td style={{ padding: '10px 0', color: '#0f172a', fontWeight: 600 }}>{vaultPath}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Obsidian Application</td>
                      <td style={{ padding: '10px 0', color: obsidianAvailable ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                        {obsidianAvailable ? 'Detected & Available (/Applications/Obsidian.app)' : 'Not Installed / Not Detected'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Snapshot Engine</td>
                      <td style={{ padding: '10px 0', color: '#047857', fontWeight: 600 }}>
                        Active (Milestone M3 SHA-256 Engine)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>Runtime Environment</td>
                      <td style={{ padding: '10px 0', color: '#0f172a', fontWeight: 600 }}>
                        {isTauriEnv ? 'Tauri Native macOS (IPC Active)' : 'Web Browser Preview'}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>External Cloud Services</td>
                      <td style={{ padding: '10px 0', color: '#64748b', fontWeight: 600 }}>OFFLINE (Independent Mode Active)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {currentTab === 'settings' && (<><AiSettings key={vaultPath} vaultPath={vaultPath!} />
              <div className="limen-card" style={{ padding: 24, maxWidth: 640 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Vault Settings</h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                    Local Vault Directory
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
  );
}
