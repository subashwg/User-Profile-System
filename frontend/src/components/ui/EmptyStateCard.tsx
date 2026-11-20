import React from 'react';
import Button from './Button.js';

export interface EmptyStateCardProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function EmptyStateCard({
  icon = '🎨',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  style,
}: EmptyStateCardProps) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    border: '1.5px dashed var(--color-border-strong)',
    borderRadius: 'var(--radius-card)',
    padding: '40px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    boxSizing: 'border-box',
    width: '100%',
    ...style,
  };

  return (
    <div style={cardStyle} className={`empty-state-card ${className}`}>
      <div style={{ fontSize: '36px', lineHeight: 1 }} aria-hidden="true">
        {icon}
      </div>
      <h3
        className="type-heading"
        style={{ margin: 0, color: 'var(--color-text)' }}
      >
        {title}
      </h3>
      <p
        className="type-body-muted"
        style={{
          margin: 0,
          maxWidth: '480px',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <div style={{ marginTop: '8px' }}>
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
