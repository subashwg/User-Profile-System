import React, { useState } from 'react';
import CardShell from '../ui/CardShell.js';
import { KindBadge, KIND_META, type PortfolioKind, StatusBadge } from '../ui/Badge.js';

export interface PortfolioCardProps {
  id?: string;
  kind: PortfolioKind;
  title: string;
  description?: string | null;
  url: string;
  cover_url?: string | null;
  source_site?: string | null;
  published_on?: string | Date | null;
  roleTitle?: string | null;
  is_featured?: boolean;
  is_hidden?: boolean;
  showRoleLabel?: boolean;
  showStatusBadges?: boolean;
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

function formatCardDate(dateStr?: string | Date | null): string | null {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function PortfolioCard({
  kind = 'other',
  title,
  description,
  url,
  cover_url,
  source_site,
  published_on,
  roleTitle,
  is_featured = false,
  is_hidden = false,
  showRoleLabel = true,
  showStatusBadges = true,
  interactive = true,
  className = '',
  style,
  onClick,
}: PortfolioCardProps) {
  const [imageError, setImageError] = useState(false);
  const meta = KIND_META[kind] || KIND_META.other;

  const formattedDate = formatCardDate(published_on);
  const captionParts: string[] = [];
  if (source_site) captionParts.push(source_site);
  if (formattedDate) captionParts.push(formattedDate);
  const caption = captionParts.join(' · ');

  const hasValidCover = !!cover_url && !imageError;

  return (
    <CardShell
      interactive={interactive}
      className={`portfolio-card ${is_hidden ? 'portfolio-card-hidden' : ''} ${className}`}
      style={{
        opacity: is_hidden ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...style,
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="portfolio-card-link focus-ring"
        onClick={onClick}
        aria-label={`${title} (${meta.label})`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexGrow: 1,
        }}
      >
        {/* 16:9 Cover Area */}
        <div
          className="portfolio-card-cover-container"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            backgroundColor: `var(--kind-${kind}-fill)`,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {hasValidCover ? (
            <img
              src={cover_url!}
              alt=""
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            /* Kind Tint Fallback with Centered Icon */
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `var(--kind-${kind}-fill)`,
                color: `var(--kind-${kind}-icon)`,
                userSelect: 'none',
              }}
              aria-hidden="true"
            >
              <span style={{ fontSize: '42px', lineHeight: 1 }}>{meta.icon}</span>
            </div>
          )}

          {/* Kind Badge pinned at top-left */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 2,
            }}
          >
            <KindBadge kind={kind} />
          </div>

          {/* Status Badges pinned at top-right (Featured / Hidden) */}
          {showStatusBadges && (is_featured || is_hidden) && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 2,
                display: 'flex',
                gap: '6px',
              }}
            >
              {is_featured && <StatusBadge status="featured" />}
              {is_hidden && <StatusBadge status="hidden" />}
            </div>
          )}
        </div>

        {/* Card Body */}
        <div
          className="portfolio-card-body"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {/* Source Site & Date Caption */}
          {caption ? (
            <span className="type-caption" style={{ minHeight: '16px' }}>
              {caption}
            </span>
          ) : (
            <span className="type-caption" style={{ minHeight: '16px' }}>
              {meta.label}
            </span>
          )}

          {/* Title (max 2 lines with ellipsis) */}
          <h3
            className="type-card-title"
            style={{
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--color-text)',
            }}
            title={title}
          >
            {title}
          </h3>

          {/* Description (max 2 lines with ellipsis) */}
          {description && (
            <p
              className="type-body-muted"
              style={{
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '14px',
                lineHeight: '20px',
              }}
              title={description}
            >
              {description}
            </p>
          )}

          {/* Card Footer (Role Label & Call-to-Action) */}
          <div
            className="portfolio-card-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {showRoleLabel && roleTitle ? (
              <span
                className="type-caption"
                style={{
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '65%',
                }}
              >
                {roleTitle}
              </span>
            ) : (
              <span />
            )}

            <span
              style={{
                color: 'var(--color-accent)',
                fontWeight: 600,
                fontSize: '13px',
                lineHeight: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.cta} →
            </span>
          </div>
        </div>
      </a>
    </CardShell>
  );
}
