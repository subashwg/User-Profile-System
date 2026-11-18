import { useState } from 'react';

interface AvatarProps {
  customAvatarUrl?: string | null;
  providerAvatarUrl?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // purple
  '#db2777', // pink
  '#ea580c', // orange
  '#059669', // emerald
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#d97706', // amber
];

export function getInitials(name?: string | null, username?: string | null, email?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (username && username.trim().length > 0) {
    return username.trim().slice(0, 2).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function getAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({
  customAvatarUrl,
  providerAvatarUrl,
  name,
  username,
  email,
  size = 80,
  className = '',
  style = {},
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const effectiveUrl = customAvatarUrl || providerAvatarUrl;
  const initials = getInitials(name, username, email);
  const identifier = name || username || email || 'user';
  const bgColor = getAvatarColor(identifier);

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    ...style,
  };

  if (effectiveUrl && !imgError) {
    return (
      <div className={`avatar-container ${className}`} style={containerStyle}>
        <img
          src={effectiveUrl}
          alt={name || username || 'User avatar'}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`avatar-container avatar-fallback ${className}`}
      style={{
        ...containerStyle,
        backgroundColor: bgColor,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: `${Math.round(size * 0.38)}px`,
        letterSpacing: '0.05em',
        userSelect: 'none',
      }}
      title={name || username || email || 'User'}
    >
      {initials}
    </div>
  );
}
