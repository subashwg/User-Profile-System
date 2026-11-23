import React, { useState } from 'react';
import { KindBadge, KIND_META, type PortfolioKind, StatusBadge } from '../ui/Badge.js';
import Button from '../ui/Button.js';
import EmptyStateCard from '../ui/EmptyStateCard.js';

export interface PortfolioItem {
  id: string;
  user_id: string;
  role_id: string;
  kind: PortfolioKind;
  title: string;
  description?: string | null;
  url: string;
  cover_url?: string | null;
  cover_source: 'none' | 'link' | 'upload';
  source_site?: string | null;
  published_on?: string | null;
  is_featured: boolean;
  is_hidden: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  role?: {
    id: string;
    title: string;
  };
}

export interface RoleGroup {
  role: {
    id: string;
    title: string;
    description?: string | null;
    position: number;
    is_primary?: boolean;
  };
  items: PortfolioItem[];
}

export interface WorkListProps {
  groups: RoleGroup[];
  loading: boolean;
  onAddItem: (preselectedRoleId?: string) => void;
  onEditItem: (item: PortfolioItem) => void;
  onDeleteItem: (item: PortfolioItem) => void;
  onToggleFeatured: (item: PortfolioItem) => void;
  onToggleHidden: (item: PortfolioItem) => void;
  onReorderItems: (roleId: string, itemIds: string[]) => void;
}

export default function WorkList({
  groups,
  loading,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onToggleFeatured,
  onToggleHidden,
  onReorderItems,
}: WorkListProps) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);

  // Reorder up/down helper
  const handleMove = (roleId: string, itemIndex: number, direction: 'up' | 'down') => {
    const group = groups.find((g) => g.role.id === roleId);
    if (!group) return;

    const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (newIndex < 0 || newIndex >= group.items.length) return;

    const itemIds = group.items.map((i) => i.id);
    const [movedId] = itemIds.splice(itemIndex, 1);
    itemIds.splice(newIndex, 0, movedId);

    onReorderItems(roleId, itemIds);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedItemId && draggedItemId !== id) {
      setDragOverItemId(id);
    }
  };

  const handleDrop = (roleId: string, targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const group = groups.find((g) => g.role.id === roleId);
    if (!group) return;

    const sourceIndex = group.items.findIndex((i) => i.id === draggedItemId);
    const targetIndex = group.items.findIndex((i) => i.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const itemIds = group.items.map((i) => i.id);
    const [movedId] = itemIds.splice(sourceIndex, 1);
    itemIds.splice(targetIndex, 0, movedId);

    setDraggedItemId(null);
    setDragOverItemId(null);
    onReorderItems(roleId, itemIds);
  };

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <p className="type-body">Loading your portfolio items...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyStateCard
        icon="💼"
        title="No roles found"
        description="Before adding portfolio work items, please create at least one role under the Roles tab."
        actionLabel="Go to Roles"
        onAction={() => {
          const rolesTab = document.querySelector<HTMLButtonElement>(
            'button.editor-tab-btn:nth-child(2)',
          );
          if (rolesTab) rolesTab.click();
        }}
      />
    );
  }

  return (
    <div className="work-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 className="type-heading" style={{ margin: 0 }}>
            Work Items &amp; Portfolio
          </h2>
          <p className="type-body-muted" style={{ margin: '4px 0 0 0' }}>
            {totalItems} {totalItems === 1 ? 'item' : 'items'} across {groups.length}{' '}
            {groups.length === 1 ? 'role' : 'roles'}. Featured items appear at the top of your public profile (max 5).
          </p>
        </div>

        <Button variant="primary" onClick={() => onAddItem()}>
          + Add Work Item
        </Button>
      </div>

      {/* Role Groups */}
      {groups.map((group) => {
        const { role, items } = group;

        return (
          <section
            key={role.id}
            className="work-role-section"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            {/* Role Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 className="type-card-title" style={{ margin: 0, fontSize: '18px' }}>
                  {role.title}
                </h3>
                {role.is_primary && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--color-accent-soft)',
                      color: 'var(--color-accent-strong)',
                    }}
                  >
                    Primary Role
                  </span>
                )}
                <span className="type-caption">
                  ({items.length} {items.length === 1 ? 'item' : 'items'})
                </span>
              </div>

              <Button variant="secondary" size="sm" onClick={() => onAddItem(role.id)}>
                + Add Work
              </Button>
            </div>

            {/* Items inside Role */}
            {items.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-input)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <p className="type-body" style={{ margin: '0 0 8px 0' }}>
                  No work items added for <strong>{role.title}</strong> yet.
                </p>
                <Button variant="subtle" size="sm" onClick={() => onAddItem(role.id)}>
                  + Add your first item under this role
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map((item, index) => {
                  const meta = KIND_META[item.kind] || KIND_META.other;
                  const isFirst = index === 0;
                  const isLast = index === items.length - 1;
                  const isDragTarget = dragOverItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={() => handleDrop(role.id, item.id)}
                      className={`work-item-row ${item.is_hidden ? 'is-hidden-row' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px 16px',
                        backgroundColor: 'var(--color-background)',
                        border: isDragTarget
                          ? '2px solid var(--color-accent)'
                          : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-input)',
                        opacity: item.is_hidden ? 0.65 : 1,
                        transition: 'all 150ms ease',
                        cursor: 'grab',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Drag Handle & Up/Down Buttons */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <span
                          title="Drag to reorder"
                          aria-hidden="true"
                          style={{
                            fontSize: '18px',
                            cursor: 'grab',
                            userSelect: 'none',
                            padding: '4px',
                          }}
                        >
                          ⋮⋮
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button
                            type="button"
                            aria-label={`Move ${item.title} up`}
                            disabled={isFirst}
                            onClick={() => handleMove(role.id, index, 'up')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isFirst ? 'var(--color-border)' : 'var(--color-text)',
                              cursor: isFirst ? 'not-allowed' : 'pointer',
                              minWidth: '24px',
                              minHeight: '22px',
                              padding: 0,
                              lineHeight: 1,
                              fontSize: '12px',
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${item.title} down`}
                            disabled={isLast}
                            onClick={() => handleMove(role.id, index, 'down')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isLast ? 'var(--color-border)' : 'var(--color-text)',
                              cursor: isLast ? 'not-allowed' : 'pointer',
                              minWidth: '24px',
                              minHeight: '22px',
                              padding: 0,
                              lineHeight: 1,
                              fontSize: '12px',
                            }}
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* 96px Thumbnail (16:9 ratio -> 96x54) */}
                      <div
                        style={{
                          width: '96px',
                          height: '54px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          backgroundColor: `var(--kind-${item.kind}-fill)`,
                          flexShrink: 0,
                          position: 'relative',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {item.cover_url ? (
                          <img
                            src={item.cover_url}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            onError={(e) => {
                              // If image fails, revert to kind icon
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: `var(--kind-${item.kind}-icon)`,
                            fontSize: '20px',
                            zIndex: 0,
                          }}
                          aria-hidden="true"
                        >
                          {meta.icon}
                        </div>
                      </div>

                      {/* Item Info (Title, Kind, Badges) */}
                      <div style={{ flexGrow: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <KindBadge kind={item.kind} showIcon={false} style={{ fontSize: '11px', padding: '1px 8px' }} />
                          {item.is_featured && <StatusBadge status="featured" />}
                          {item.is_hidden && <StatusBadge status="hidden" />}
                        </div>
                        <h4
                          className="type-card-title"
                          style={{
                            margin: 0,
                            fontSize: '15px',
                            lineHeight: '20px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                        {item.source_site && (
                          <span className="type-caption" style={{ marginTop: '2px', display: 'block' }}>
                            {item.source_site}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons (Touch target ≥ 44x44px) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: 'auto',
                        }}
                      >
                        {/* Star / Feature Button */}
                        <button
                          type="button"
                          onClick={() => onToggleFeatured(item)}
                          aria-label={item.is_featured ? 'Unfeature this item' : 'Feature this item'}
                          title={item.is_featured ? 'Unfeature item' : 'Feature item (max 5)'}
                          className="focus-ring"
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: item.is_featured ? 'var(--color-accent-soft)' : 'none',
                            color: item.is_featured ? 'var(--color-accent-strong)' : 'var(--color-text-muted)',
                            border: item.is_featured
                              ? '1px solid var(--color-accent)'
                              : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-input)',
                            cursor: 'pointer',
                            fontSize: '18px',
                          }}
                        >
                          {item.is_featured ? '★' : '☆'}
                        </button>

                        {/* Eye / Hide Button */}
                        <button
                          type="button"
                          onClick={() => onToggleHidden(item)}
                          aria-label={item.is_hidden ? 'Unhide this item' : 'Hide this item'}
                          title={item.is_hidden ? 'Make visible to visitors' : 'Hide from visitors'}
                          className="focus-ring"
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: item.is_hidden ? 'rgba(91, 98, 112, 0.15)' : 'none',
                            color: item.is_hidden ? 'var(--color-text-muted)' : 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-input)',
                            cursor: 'pointer',
                            fontSize: '16px',
                          }}
                        >
                          {item.is_hidden ? '👁' : '👁‍🗨'}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          aria-label={`Edit ${item.title}`}
                          title="Edit work item"
                          className="focus-ring"
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-input)',
                            cursor: 'pointer',
                            fontSize: '15px',
                          }}
                        >
                          ✏️
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item)}
                          aria-label={`Delete ${item.title}`}
                          title="Delete work item"
                          className="focus-ring"
                          style={{
                            minWidth: '44px',
                            minHeight: '44px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            color: 'var(--color-danger)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-input)',
                            cursor: 'pointer',
                            fontSize: '15px',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
