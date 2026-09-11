import React from 'react';

export interface StatusBadgeProps {
  status: 'READY' | 'INITIALIZING' | 'INVALID' | 'NO_VAULT' | 'NOT_CONFIGURED' | 'OFFLINE' | 'STALE_SNAPSHOT';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getStyleClass = () => {
    switch (status) {
      case 'READY':
        return 'limen-badge-ready';
      case 'INITIALIZING':
      case 'NO_VAULT':
      case 'INVALID':
      case 'STALE_SNAPSHOT':
        return 'limen-badge-warn';
      case 'NOT_CONFIGURED':
      case 'OFFLINE':
      default:
        return 'limen-badge-off';
    }
  };

  const textLabel = label || status.replace('_', ' ');

  return (
    <span className={`limen-badge ${getStyleClass()}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
      {textLabel}
    </span>
  );
};
