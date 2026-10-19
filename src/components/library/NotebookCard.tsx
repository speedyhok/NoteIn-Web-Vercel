import { NotebookPagePreview } from './NotebookPagePreview';
import React, { useState } from 'react';
import type { Notebook } from '../../types';
import { Trash2,
  FolderInput, Edit2, Star } from 'lucide-react';
import { NoteinMore } from '../icons/NoteinIcons';

interface NotebookCardProps {
  notebook: Notebook;
  onOpen: (notebook: Notebook) => void;
  onRename: (notebook: Notebook) => void;
  onDelete: (notebook: Notebook) => void;
  onMoveToFolder?: (notebook: Notebook) => void;
  onToggleFavorite?: (notebook: Notebook) => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
  notebook,
  onOpen,
  onRename,
  onDelete,
  onMoveToFolder,
  onToggleFavorite,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };



  // Derive secondary description (e.g. Strokes or Pages)
  const subtitleText = notebook.strokeCount
    ? `${notebook.strokeCount.toLocaleString()} Strokes • Synced`
    : `${formatDate(notebook.updatedAt)} • ${notebook.pageCount || 1} ${notebook.pageCount === 1 ? 'Page' : 'Pages'}`;

  return (
    <div
      className="notebook-card"
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', notebook.id);
        e.dataTransfer.setData('application/json', JSON.stringify({ notebookId: notebook.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
        transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
      onClick={() => onOpen(notebook)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.05)';
      }}
    >
      {/* Document Page Preview (Like the file itself with paper lines and vector ink strokes) */}
      <div
        style={{
          height: '196px',
          backgroundColor: 'var(--bg-tertiary)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <NotebookPagePreview notebook={notebook} />
      </div>

      {/* Info Body & 3-Dot Context Options */}
      <div
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRename(notebook);
            }}
            title="Click to rename"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                margin: 0,
                transition: 'color 0.15s ease',
              }}
              className="notebook-card-title-hover"
            >
              {notebook.title}
            </h3>
            <Edit2 size={12} color="var(--text-muted)" style={{ flexShrink: 0, opacity: 0.65 }} />
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{subtitleText}</span>
          </div>
        </div>

        {/* Action Menu */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: '6px',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Notebook options"
          >
            <NoteinMore size={18} />
          </button>

          {menuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="animate-scale-up"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: '100%',
                  marginBottom: '6px',
                  width: '140px',
                  borderRadius: '10px',
                  padding: '5px',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                }}
              >
                {onToggleFavorite && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleFavorite(notebook);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: notebook.isFavorite ? '#f59e0b' : 'var(--text-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <Star size={13} fill={notebook.isFavorite ? '#f59e0b' : 'none'} />
                    {notebook.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(notebook);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                  }}
                >
                  <Edit2 size={13} />
                  Rename
                </button>
                                {onMoveToFolder && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onMoveToFolder(notebook);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                    }}
                  >
                    <FolderInput size={13} color="#007AFF" />
                    Move to Folder
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(notebook);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--danger, #ef4444)',
                    textAlign: 'left',
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
