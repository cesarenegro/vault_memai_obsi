export interface VaultStatusResponse {
  state: 'READY' | 'INITIALIZING' | 'INVALID' | 'NO_VAULT' | 'NOT_ACCESSIBLE' | 'INCOMPLETE';
  path: string | null; name: string | null; page_count: number; source_count: number; proposal_count: number;
  snapshot_id: string | null; snapshot_age: string | null; integrity_status: 'valid' | 'corrupted' | 'unverified';
}
export interface ValidationResultResponse {
  is_valid: boolean; errors: string[]; warnings: string[]; checked_folders_count: number; checked_files_count: number; system_files_valid: boolean;
}
export interface OpenVaultResponse { status: VaultStatusResponse; validation: ValidationResultResponse }
export interface VaultIntegrityReportResponse {
  is_integrity_valid:boolean;manifest_present:boolean;total_manifested_files:number;verified_files_count:number;
  modified_files:string[];missing_files:string[];added_files:string[];errors:string[];
}
export interface SnapshotItemResponse {
  id:string;vault_path:string;snapshot_path:string;created_at:string;note?:string|null;manifest_file_count:number;integrity_status:'valid'|'corrupted'|'incomplete';
}

export interface RawSourceItem {
  relative_path: string;
  name: string;
  extension: string;
  size_bytes: number;
  is_compiled: boolean;
  status: 'UNCOMPILED' | 'COMPILED' | 'CHANGED' | 'ERROR';
  first_compiled_at?: string | null;
  error?: string | null;
}

export interface ProposalItem { relative_path: string; title: string; status: string; markdown: string }

export interface CompilationItemResult {
  source_relative_path: string;
  status: 'compiled' | 'unchanged' | 'unsupported' | 'error';
  draft_relative_path?: string | null;
  error?: string | null;
}

export interface BatchCompilerReport {
  compiled_count: number;
  unchanged_count: number;
  unsupported_count: number;
  error_count: number;
  items: CompilationItemResult[];
}

export interface SearchQuery {
  term?: string;
  category?: string;
  client?: string;
  project?: string;
  tags?: string[];
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  relative_path: string;
  category: string;
  client?: string;
  project?: string;
  tags: string[];
  status?: string;
  snippet: string;
  score: number;
  updated_at?: string;
  sha256: string;
}

export interface IndexStatusReport {
  state: 'missing' | 'ready' | 'outdated';
  total_indexed: number;
  last_indexed_at: string;
  version: number;
  indexed_categories: Record<string, number>;
}

function report(value: unknown): VaultIntegrityReportResponse {
  const v=value as VaultIntegrityReportResponse;
  if(!v||typeof v.is_integrity_valid!=='boolean'||typeof v.manifest_present!=='boolean'
    ||![v.total_manifested_files,v.verified_files_count].every(n=>Number.isSafeInteger(n)&&n>=0)
    ||![v.modified_files,v.missing_files,v.added_files,v.errors].every(a=>Array.isArray(a)&&a.every(x=>typeof x==='string'))
    ||(v.is_integrity_valid&&(!v.manifest_present||v.verified_files_count!==v.total_manifested_files||[v.modified_files,v.missing_files,v.added_files,v.errors].some(a=>a.length))))throw new Error('Invalid native integrity report');
  return v;
}
function snapshot(value:unknown):SnapshotItemResponse {
  const v=value as SnapshotItemResponse;
  if(!v||![v.id,v.vault_path,v.snapshot_path,v.created_at].every(x=>typeof x==='string')||!v.id.startsWith('snap-')
    ||!Number.isSafeInteger(v.manifest_file_count)||v.manifest_file_count<0||!['valid','corrupted','incomplete'].includes(v.integrity_status)
    ||!(v.note==null||typeof v.note==='string'))throw new Error('Invalid native snapshot');
  return v;
}
function searchStatus(value:unknown):IndexStatusReport {
  const v=value as IndexStatusReport;
  if(!v||!['missing','ready','outdated'].includes(v.state)||!Number.isSafeInteger(v.total_indexed)||v.total_indexed<0||typeof v.last_indexed_at!=='string'||!Number.isSafeInteger(v.version)||!v.indexed_categories||typeof v.indexed_categories!=='object'||Object.values(v.indexed_categories).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid native search status');
  return v;
}
function searchResults(value:unknown):SearchResultItem[]{
  if(!Array.isArray(value))throw new Error('Invalid native search results');
  for(const r of value)if(!r||![r.id,r.title,r.relative_path,r.category,r.snippet,r.sha256].every(v=>typeof v==='string')||!Number.isFinite(r.score)||r.score<0||!Array.isArray(r.tags)||r.tags.some((v:unknown)=>typeof v!=='string')||!/^[a-f0-9]{64}$/.test(r.sha256))throw new Error('Invalid native search result');
  return value;
}
export type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
function status(value: unknown): VaultStatusResponse {
  const v = value as VaultStatusResponse;
  if (!v || !['READY','INITIALIZING','INVALID','NO_VAULT','NOT_ACCESSIBLE','INCOMPLETE'].includes(v.state)
    || !['page_count','source_count','proposal_count'].every(k => Number.isSafeInteger(v[k as keyof VaultStatusResponse]) && Number(v[k as keyof VaultStatusResponse]) >= 0)
    || !['path','name','snapshot_id','snapshot_age'].every(k => v[k as keyof VaultStatusResponse] === null || typeof v[k as keyof VaultStatusResponse] === 'string')
    || !['valid','corrupted','unverified'].includes(v.integrity_status)) throw new Error('Invalid native Vault response');
  return v;
}
export function createVaultIpc(invoke: Invoke, native: () => boolean) {
  let active = false;
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    if (!native()) throw new Error('Native Tauri IPC runtime required. Operating in web browser preview mode.');
    if (active) throw new Error('A Vault operation is already running');
    active = true;
    try { return await operation(); } finally { active = false; }
  }
  async function readOnly<T>(operation:()=>Promise<T>):Promise<T>{
    if(!native())throw new Error('Native Tauri IPC runtime required. Operating in web browser preview mode.');
    return operation();
  }
  return {
    create: (path: string) => run(async () => status(await invoke('create_vault', { targetPath: path, vaultName: path.split('/').pop() || 'LIMEN Vault' }))),
    open: (path: string) => run(async (): Promise<OpenVaultResponse> => {
      const res = await invoke<OpenVaultResponse>('open_vault', { targetPath: path });
      status(res?.status);
      const v = res.validation;
      if (!v || typeof v.is_valid !== 'boolean' || typeof v.system_files_valid !== 'boolean'
        || ![v.checked_files_count,v.checked_folders_count].every(n => Number.isSafeInteger(n) && n >= 0)
        || ![v.errors,v.warnings].every(a => Array.isArray(a) && a.every(s => typeof s === 'string'))
        || (res.status.state === 'READY') !== v.is_valid) throw new Error('Invalid native validation response');
      return res;
    }),
    inspect: (path:string) => run(async () => {
      const list=await invoke<unknown>('list_snapshots',{targetPath:path});
      if(!Array.isArray(list))throw new Error('Invalid native snapshot list');
      const snapshots=list.map(snapshot);
      const integrity=report(await invoke('verify_vault_integrity',{targetPath:path}));
      return {snapshots,integrity};
    }),
    createSnapshot: (path:string,note?:string) => run(async()=>snapshot(await invoke('create_snapshot',{targetPath:path,note:note??null}))),
    listProposals: (path:string) => run(async () => {
      const rows=await invoke<ProposalItem[]>('list_proposals',{vaultPath:path});
      if(!Array.isArray(rows)||rows.some(r=>!r||![r.relative_path,r.title,r.status,r.markdown].every(v=>typeof v==='string')||!r.relative_path.startsWith('90_PROPOSALS/')))throw new Error('Invalid native proposals');
      return rows;
    }),
    listRawSources: (path: string) => run(async () => invoke<RawSourceItem[]>('list_raw_sources', { vaultPath: path })),
    compileSource: (path: string, relativeSourcePath: string) => run(async () => invoke<CompilationItemResult>('compile_source', { vaultPath: path, relativeSourcePath })),
    batchCompileSources: (path: string) => run(async () => invoke<BatchCompilerReport>('batch_compile_sources', { vaultPath: path })),
    indexVaultSearch: (path: string) => run(async () => searchStatus(await invoke('index_vault_search', { vaultPath: path }))),
    searchVault: (path: string, query: SearchQuery) => readOnly(async () => searchResults(await invoke('search_vault', { vaultPath: path, query }))),
    getSearchIndexStatus: (path: string) => readOnly(async () => searchStatus(await invoke('get_search_index_status', { vaultPath: path }))),
    obsidian: (path: string) => run(() => invoke<void>('open_obsidian', { vaultPath: path })),
  };
}
