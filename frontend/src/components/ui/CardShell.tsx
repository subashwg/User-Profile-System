import React, { useState } from 'react';

export interface CardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export default function CardShell({
  children,
  interactive = true,
  selected = false,
  className = '',
  style,
  ...props
}: CardShellProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    border: selected
      ? '1.5px solid var(--color-accent)'
      : '1px solid var(--color-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: interactive && isHovered
      ? 'var(--shadow-card-hover)'
      : 'var(--shadow-card-rest)',
    transform: interactive && isHovered
      ? 'translateY(-2px)'
      : 'none',
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
    overflow: 'hidden',
    boxSizing: 'border-box',
    position: 'relative',
    ...style,
  };

  return (
    <div
      style={cardStyle}
      className={`card-shell ${interactive ? 'is-interactive' : ''} ${className}`}
      onMouseEnter={() => interactive && setIsHovered(true)}
      onMouseLeave={() => interactive && setIsHovered(false)}
      {...props}
    >
      {children}
    </div>
  );
}
