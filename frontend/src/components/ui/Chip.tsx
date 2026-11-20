import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  count?: number;
  selected?: boolean;
}

export default function Chip({
  label,
  count,
  selected = false,
  className = '',
  style,
  disabled,
  ...props
}: ChipProps) {
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--font-family)',
    fontSize: '13px',
    lineHeight: '20px',
    fontWeight: selected ? 600 : 500,
    borderRadius: 'var(--radius-pill)',
    padding: '6px 14px',
    minHeight: '36px',
    border: selected
      ? '1px solid var(--color-accent)'
      : '1px solid var(--color-border)',
    backgroundColor: selected
      ? 'var(--color-accent-soft)'
      : 'var(--color-surface)',
    color: selected
      ? 'var(--color-accent-strong)'
      : 'var(--color-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease-in-out',
    boxSizing: 'border-box',
    outline: 'none',
    ...style,
  };

  const countBadgeStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 'var(--radius-pill)',
    backgroundColor: selected
      ? 'rgba(14, 124, 123, 0.2)'
      : 'var(--color-border)',
    color: selected
      ? 'var(--color-accent-strong)'
      : 'var(--color-text-muted)',
  };

  return (
    <button
      type="button"
      role="button"
      aria-pressed={selected}
      disabled={disabled}
      style={chipStyle}
      className={`chip-ui ${selected ? 'is-selected' : ''} ${className}`}
      {...props}
    >
      <span>{label}</span>
      {count !== undefined && <span style={countBadgeStyle}>{count}</span>}
    </button>
  );
}
