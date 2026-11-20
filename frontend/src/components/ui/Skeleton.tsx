import React from 'react';
import CardShell from './CardShell.js';

export function SkeletonLine({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  style,
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="shimmer-effect"
      style={{
        width,
        height,
        borderRadius,
        boxSizing: 'border-box',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export default function SkeletonCard({
  aspectRatio = '16 / 9',
  className = '',
  style,
}: {
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <CardShell interactive={false} className={`skeleton-card ${className}`} style={style}>
      {/* 16:9 Cover Placeholder */}
      <div
        className="shimmer-effect"
        style={{
          width: '100%',
          aspectRatio,
          borderBottom: '1px solid var(--color-border)',
        }}
        aria-hidden="true"
      />

      {/* Body Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Caption (source site + date) */}
        <SkeletonLine width="40%" height="12px" />

        {/* Title (2 lines) */}
        <SkeletonLine width="90%" height="18px" />
        <SkeletonLine width="70%" height="18px" />

        {/* Description (2 lines) */}
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SkeletonLine width="100%" height="14px" />
          <SkeletonLine width="85%" height="14px" />
        </div>

        {/* Footer (Role badge + CTA) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <SkeletonLine width="30%" height="14px" />
          <SkeletonLine width="25%" height="14px" />
        </div>
      </div>
    </CardShell>
  );
}
