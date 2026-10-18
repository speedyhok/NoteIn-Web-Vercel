import React, { useState } from 'react';
import { MoreVertical, Edit2, Trash2, BookOpen } from 'lucide-react';
import type { Notebook } from '../../types';

interface NotebookCardProps {
  notebook: Notebook;
  onOpen: (notebook: Notebook) => void;
  onRename: (notebook: Notebook) => void;
  onDelete: (notebook: Notebook) => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
  notebook,
  onOpen,
  onRename,
  onDelete,
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

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
        cursor: 'pointer',
        transition: 'all var(--transition-normal)',
        overflow: 'hidden',
      }}
      className="notebook-card"
      onClick={() => onOpen(notebook)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(0, 0, 0, 0.08)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      {/* Notebook Cover Illustration */}
      <div
        style={{
          height: '160px',
          backgroundColor: notebook.coverColor || '#2563eb',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Leather spine effect */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '18px',
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
            borderRight: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: 'inset -2px 0 6px rgba(0, 0, 0, 0.25)',
          }}
        />

        {/* Embossed Bookmark / Label Plate on Cover */}
        <div
          style={{
            width: '82%',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginLeft: '8px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#1e293b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {notebook.title}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'capitalize',
            }}
          >
            <BookOpen size={12} />
            {notebook.defaultTemplate.type} paper
          </div>
        </div>
      </div>

      {/* Info Card Body */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {notebook.title}
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {notebook.pageCount || 1} {notebook.pageCount === 1 ? 'page' : 'pages'} • {formatDate(notebook.updatedAt)}
          </div>
        </div>

        {/* More Options Button */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            aria-label="Notebook options"
          >
            <MoreVertical size={16} />
          </button>

          {/* Context Dropdown Menu */}
          {menuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="glass-panel animate-scale-up"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  width: '140px',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(notebook);
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    justifyContent: 'flex-start',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Edit2 size={14} />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(notebook);
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    justifyContent: 'flex-start',
                    color: 'var(--danger)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Trash2 size={14} />
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
