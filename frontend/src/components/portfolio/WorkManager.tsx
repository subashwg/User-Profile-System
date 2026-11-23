import { useEffect, useState } from 'react';
import WorkForm, { type RoleOption } from './WorkForm.js';
import WorkList, { type PortfolioItem, type RoleGroup } from './WorkList.js';

export interface WorkManagerProps {
  apiUrl: string;
  user: {
    id: string;
    username?: string | null;
  };
  onItemsChanged?: () => void;
}

export default function WorkManager({ apiUrl, onItemsChanged }: WorkManagerProps) {
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [preselectedRoleId, setPreselectedRoleId] = useState<string | undefined>();

  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PortfolioItem | null>(null);

  // Fetch items grouped by role and roles
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch items
      const itemsRes = await fetch(`${apiUrl}/items`, {
        credentials: 'include',
      });
      if (!itemsRes.ok) throw new Error('Failed to load portfolio items');
      const itemsData: RoleGroup[] = await itemsRes.json();
      setGroups(itemsData);

      // 2. Fetch roles for the form dropdown
      const rolesRes = await fetch(`${apiUrl}/roles`, {
        credentials: 'include',
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(
          rolesData.map((r: { id: string; title: string }) => ({
            id: r.id,
            title: r.title,
          })),
        );
      }
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiUrl]);

  // Handle open Add form
  const handleOpenAdd = (preselectedRole?: string) => {
    setEditingItem(null);
    setPreselectedRoleId(preselectedRole);
    setView('add');
    setNotice(null);
  };

  // Handle open Edit form
  const handleOpenEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setPreselectedRoleId(item.role_id);
    setView('edit');
    setNotice(null);
  };

  // Handle form save (both Add & Edit)
  const handleSaveForm = async ({
    itemData,
    coverFile,
  }: {
    itemData: Parameters<React.ComponentProps<typeof WorkForm>['onSave']>[0]['itemData'];
    coverFile?: File | null;
  }) => {
    let savedItem: PortfolioItem;

    if (view === 'edit' && editingItem) {
      // PATCH existing item
      const res = await fetch(`${apiUrl}/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(itemData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update work item');
      }
      savedItem = data;
    } else {
      // POST new item
      const res = await fetch(`${apiUrl}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(itemData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create work item');
      }
      savedItem = data;
    }

    // If an image file was selected for upload, upload it to /items/:id/cover
    if (coverFile) {
      const formData = new FormData();
      formData.append('file', coverFile);

      const coverRes = await fetch(`${apiUrl}/items/${savedItem.id}/cover`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!coverRes.ok) {
        const coverData = await coverRes.json();
        throw new Error(coverData.message || 'Item saved, but cover image upload failed');
      }
    }

    setNotice({
      type: 'success',
      message: view === 'edit' ? 'Work item updated successfully!' : 'Work item created successfully!',
    });

    setView('list');
    await loadData();
    if (onItemsChanged) onItemsChanged();
  };

  // Toggle Featured
  const handleToggleFeatured = async (item: PortfolioItem) => {
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_featured: !item.is_featured }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update featured status');
      }

      setNotice({
        type: 'success',
        message: item.is_featured ? 'Item unfeatured' : '★ Item featured on public page!',
      });
      await loadData();
      if (onItemsChanged) onItemsChanged();
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    }
  };

  // Toggle Hidden
  const handleToggleHidden = async (item: PortfolioItem) => {
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_hidden: !item.is_hidden }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update hidden status');
      }

      setNotice({
        type: 'success',
        message: item.is_hidden ? 'Item is now visible to visitors' : 'Item is now hidden from visitors',
      });
      await loadData();
      if (onItemsChanged) onItemsChanged();
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    }
  };

  // Reorder items in role
  const handleReorderItems = async (roleId: string, itemIds: string[]) => {
    try {
      const res = await fetch(`${apiUrl}/roles/${roleId}/items/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ item_ids: itemIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to reorder items');
      }

      await loadData();
      if (onItemsChanged) onItemsChanged();
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
    }
  };

  // Delete item
  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;

    try {
      const res = await fetch(`${apiUrl}/items/${deleteConfirmItem.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete work item');
      }

      setNotice({ type: 'success', message: 'Work item deleted successfully.' });
      setDeleteConfirmItem(null);
      await loadData();
      if (onItemsChanged) onItemsChanged();
    } catch (err) {
      setNotice({ type: 'error', message: (err as Error).message });
      setDeleteConfirmItem(null);
    }
  };

  return (
    <div className="work-manager" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Notice Alert */}
      {notice && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-input)',
            backgroundColor:
              notice.type === 'success' ? 'var(--color-accent-soft)' : 'rgba(180, 35, 24, 0.1)',
            color:
              notice.type === 'success' ? 'var(--color-accent-strong)' : 'var(--color-danger)',
            border: `1px solid ${
              notice.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'
            }`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal / Banner */}
      {deleteConfirmItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: 'var(--shadow-card-hover)',
            }}
          >
            <h3 className="type-card-title" style={{ margin: '0 0 8px 0' }}>
              Delete Work Item?
            </h3>
            <p className="type-body-muted" style={{ margin: '0 0 20px 0' }}>
              Are you sure you want to delete <strong>"{deleteConfirmItem.title}"</strong>? Its uploaded cover image and attachments will also be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Switch: Work List vs Work Form */}
      {view === 'list' ? (
        <WorkList
          groups={groups}
          loading={loading}
          onAddItem={handleOpenAdd}
          onEditItem={handleOpenEdit}
          onDeleteItem={(item) => setDeleteConfirmItem(item)}
          onToggleFeatured={handleToggleFeatured}
          onToggleHidden={handleToggleHidden}
          onReorderItems={handleReorderItems}
        />
      ) : (
        <WorkForm
          initialItem={editingItem}
          roles={roles}
          preselectedRoleId={preselectedRoleId}
          apiUrl={apiUrl}
          onSave={handleSaveForm}
          onCancel={() => {
            setView('list');
            setNotice(null);
          }}
        />
      )}
    </div>
  );
}
