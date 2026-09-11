import React from 'react';
import { StatusBadge } from './StatusBadge.js';

export interface VaultStatusBannerProps {
  status: 'READY' | 'INITIALIZING' | 'INVALID' | 'NO_VAULT' | 'STALE_SNAPSHOT';
  vaultName?: string | null;
  vaultPath?: string | null;
  pageCount?: number;
  onOpenObsidian?: () => void;
  obsidianAvailable?: boolean;
}

export const VaultStatusBanner: React.FC<VaultStatusBannerProps> = ({
  status,
  vaultName,
  vaultPath,
  pageCount = 0,
  onOpenObsidian,
  obsidianAvailable = true,
}) => {
  return (
    <div
      className="limen-card"
      style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <StatusBadge status={status} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--limen-text-primary)' }}>
            {vaultName || 'No Vault Loaded'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--limen-text-muted)', marginTop: 2 }}>
            {vaultPath ? vaultPath : 'Select or create a local Vault directory'} • {pageCount} Knowledge Pages
          </div>
        </div>
      </div>

      {onOpenObsidian && (
        <button
          onClick={onOpenObsidian}
          disabled={!obsidianAvailable || status === 'NO_VAULT'}
          title={!obsidianAvailable ? 'Obsidian app not detected on local Mac' : 'Open Vault in Obsidian'}
          style={{
            backgroundColor: 'transparent',
            color: obsidianAvailable ? 'var(--limen-text-primary)' : 'var(--limen-text-muted)',
            border: '1px solid var(--limen-border-light)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: obsidianAvailable ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>Open in Obsidian</span>
          {!obsidianAvailable && <span style={{ fontSize: 10, color: '#e11d48' }}>(Unavailable)</span>}
        </button>
      )}
    </div>
  );
};
