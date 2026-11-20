import React from 'react';

export type PortfolioKind = 'video' | 'article' | 'course' | 'project' | 'product' | 'other';

export interface KindBadgeProps {
  kind: PortfolioKind;
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export interface StatusBadgeProps {
  status: 'featured' | 'hidden';
  className?: string;
  style?: React.CSSProperties;
}

export const KIND_META: Record<PortfolioKind, { label: string; icon: string; cta: string }> = {
  video: { label: 'Video', icon: '▶', cta: 'Watch' },
  article: { label: 'Article', icon: '📄', cta: 'Read' },
  course: { label: 'Course', icon: '🎓', cta: 'Open course' },
  project: { label: 'Project', icon: '🚀', cta: 'View project' },
  product: { label: 'Product', icon: '📦', cta: 'View product' },
  other: { label: 'Other', icon: '🔗', cta: 'Open' },
};

export function KindBadge({ kind, showIcon = true, className = '', style }: KindBadgeProps) {
  const meta = KIND_META[kind] || KIND_META.other;

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontFamily: 'var(--font-family)',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    padding: '3px 10px',
    backgroundColor: `var(--kind-${kind}-fill)`,
    color: `var(--kind-${kind}-icon)`,
    border: `1px solid var(--kind-${kind}-icon)`,
    boxSizing: 'border-box',
    textTransform: 'capitalize',
    ...style,
  };

  return (
    <span style={badgeStyle} className={`badge-kind badge-kind-${kind} ${className}`}>
      {showIcon && <span aria-hidden="true" style={{ fontSize: '11px' }}>{meta.icon}</span>}
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusBadge({ status, className = '', style }: StatusBadgeProps) {
  const isFeatured = status === 'featured';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontFamily: 'var(--font-family)',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    padding: '3px 10px',
    backgroundColor: isFeatured ? 'var(--color-accent-soft)' : 'rgba(91, 98, 112, 0.15)',
    color: isFeatured ? 'var(--color-accent-strong)' : 'var(--color-text-muted)',
    border: isFeatured ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <span style={badgeStyle} className={`badge-status badge-status-${status} ${className}`}>
      <span aria-hidden="true">{isFeatured ? '★' : '👁'}</span>
      <span>{isFeatured ? 'Featured' : 'Hidden'}</span>
    </span>
  );
}
