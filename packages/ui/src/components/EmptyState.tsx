import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div
      className="limen-card"
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 540,
        margin: '32px auto',
      }}
    >
      {icon && <div style={{ marginBottom: 16, color: 'var(--limen-text-muted)' }}>{icon}</div>}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--limen-text-primary)', margin: '0 0 8px 0' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--limen-text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            backgroundColor: 'var(--limen-accent-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
