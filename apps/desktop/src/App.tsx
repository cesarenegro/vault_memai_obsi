import React, { useState } from 'react';
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
  const [vaultPath, setVaultPath] = useState<string | null>('/Users/cesare/Documents/VAULT');
  const [vaultName, setVaultName] = useState<string | null>('LIMEN Vault');
  const [pageCount, setPageCount] = useState<number>(2);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [obsidianAvailable, setObsidianAvailable] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('clients');

  const handleCreateVault = () => {
    const target = vaultPath || '/Users/cesare/Documents/VAULT';
    setVaultPath(target);
    setVaultName('LIMEN Vault');
    setVaultState('READY');
    setPageCount(2);
    setValidationErrors([]);
    setVaultLoaded(true);
  };

  const handleOpenExistingVault = () => {
    const target = vaultPath || '/Users/cesare/Documents/VAULT';
    setVaultPath(target);
    setVaultName('LIMEN Vault');
    setVaultState('READY');
    setPageCount(2);
    setValidationErrors([]);
    setVaultLoaded(true);
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
                Desktop v0.1.0 (Local)
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
              { id: 'snapshots', label: 'Snapshots', icon: <History size={16} /> },
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
            onClick={() => {
              if (obsidianAvailable && vaultLoaded) {
                alert(`Launching Obsidian for Vault at: ${vaultPath}`);
              }
            }}
            disabled={!vaultLoaded || !obsidianAvailable}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--limen-border-light)',
              backgroundColor: vaultLoaded ? '#ffffff' : '#f8fafc',
              color: vaultLoaded ? '#0f172a' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: vaultLoaded ? 'pointer' : 'not-allowed',
            }}
          >
            <ExternalLink size={14} />
            <span>Open in Obsidian</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
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

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={handleCreateVault}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PlusCircle size={16} />
                <span>CREATE NEW VAULT</span>
              </button>

              <button
                onClick={handleOpenExistingVault}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={16} />
                <span>OPEN EXISTING VAULT</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VAULT BANNER */}
            <VaultStatusBanner
              status={vaultState === 'READY' ? 'READY' : 'INVALID'}
              vaultName={vaultName}
              vaultPath={vaultPath}
              pageCount={pageCount}
              onOpenObsidian={() => alert(`Launching Obsidian for Vault: ${vaultPath}`)}
              obsidianAvailable={obsidianAvailable}
            />

            {/* SCREEN RENDERER */}
            {currentTab === 'home' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                  <MetricCard title="Knowledge Pages" value={0} subtitle="Compiled Markdown files" />
                  <MetricCard title="Raw Sources" value={0} subtitle="Read-only documents" />
                  <MetricCard title="AI Proposals" value={0} subtitle="Awaiting review" />
                  <MetricCard title="Snapshot Status" value="VALID" subtitle="SHA-256 integrity verified" />
                </div>

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
                    <StatusBadge status="NOT_CONFIGURED" label="Coming in M6" />
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 12 }}>
                      Ask Knowledge query engine will interface with OpenAI & Codex in Milestone 6.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'ask' && (
              <EmptyState
                title="Ask Knowledge (AI Not Configured)"
                description="AI inference integration will be introduced in Milestone 6. Direct queries will interface with OpenAI & Codex over local knowledge snapshots."
                icon={<MessageSquare size={32} />}
              />
            )}

            {currentTab === 'knowledge' && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
                  {['clients', 'projects', 'brands', 'positioning', 'packaging', 'methods', 'case_studies', 'research'].map((cat) => (
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

                <EmptyState
                  title={`No ${selectedCategory.replace('_', ' ')} pages found`}
                  description={`Vault directory 0${['clients','projects','brands','positioning','packaging','methods','case_studies','research'].indexOf(selectedCategory) + 1}_${selectedCategory.toUpperCase()} is currently empty.`}
                  icon={<BookOpen size={32} />}
                />
              </div>
            )}

            {currentTab === 'sources' && (
              <EmptyState
                title="Raw Sources (20_RAW_SOURCES)"
                description="No raw document sources uploaded. Raw sources are read-only input materials."
                icon={<FolderArchive size={32} />}
              />
            )}

            {currentTab === 'search' && (
              <div className="limen-card" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0' }}>Local Offline Search</h3>
                <input
                  type="text"
                  placeholder="Search local titles, frontmatter, and markdown content..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    marginBottom: 20,
                  }}
                />
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                  Local search engine interfaces will index Markdown files during Milestone 5.
                </div>
              </div>
            )}

            {currentTab === 'outputs' && (
              <EmptyState
                title="AI Outputs (80_AI_OUTPUTS)"
                description="No AI generated document outputs generated yet."
                icon={<Sparkles size={32} />}
              />
            )}

            {currentTab === 'proposals' && (
              <EmptyState
                title="Candidate Proposals (90_PROPOSALS)"
                description="No pending candidate knowledge proposals awaiting human review."
                icon={<FileCheck size={32} />}
              />
            )}

            {currentTab === 'snapshots' && (
              <EmptyState
                title="Local Vault Snapshots"
                description="Snapshot manifest engine will record versioned file integrity manifests during Milestone 3."
                icon={<History size={32} />}
              />
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
                      <td style={{ padding: '10px 0', color: '#047857', fontWeight: 600 }}>Detected & Available</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#64748b' }}>External Cloud Services</td>
                      <td style={{ padding: '10px 0', color: '#64748b', fontWeight: 600 }}>OFFLINE (Independent Mode Active)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {currentTab === 'settings' && (
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
