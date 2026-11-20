import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  style,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-family)',
    fontSize: size === 'sm' ? '13px' : '15px',
    lineHeight: size === 'sm' ? '20px' : '24px',
    fontWeight: 500,
    borderRadius: 'var(--radius-interactive)',
    minHeight: size === 'sm' ? '36px' : '44px', // 44px ensures accessible touch target
    padding: size === 'sm' ? '6px 14px' : '10px 18px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease-in-out',
    textDecoration: 'none',
    boxSizing: 'border-box',
    width: fullWidth ? '100%' : 'auto',
    border: '1px solid transparent',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-accent)',
      color: '#FFFFFF',
      border: '1px solid var(--color-accent)',
    },
    secondary: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: '#FFFFFF',
      border: '1px solid var(--color-danger)',
    },
    subtle: {
      backgroundColor: 'transparent',
      color: 'var(--color-text)',
      border: '1px solid transparent',
    },
  };

  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      style={combinedStyle}
      disabled={disabled}
      className={`btn-ui btn-${variant} ${className}`}
      {...props}
    >
      {icon && iconPosition === 'left' && <span aria-hidden="true">{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span aria-hidden="true">{icon}</span>}
    </button>
  );
}
