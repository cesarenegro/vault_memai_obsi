import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon }) => {
  return (
    <div className="limen-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--limen-text-secondary)' }}>{title}</span>
        {icon && <div style={{ color: 'var(--limen-text-muted)' }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--limen-text-primary)' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--limen-text-muted)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
