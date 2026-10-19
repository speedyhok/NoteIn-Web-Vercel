import React, { useState } from 'react';
import type { Notebook } from '../../types';
import { MoreVertical, BookOpen, Trash2, Edit2 } from 'lucide-react';

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

  const getTextureClass = () => {
    switch (notebook.coverPattern) {
      case 'marble':
        return 'cover-texture-marble';
      case 'gradient':
        return 'cover-texture-gradient';
      case 'minimal':
        return 'cover-texture-minimal';
      default:
        return '';
    }
  };

  return (
    <div
      className="notebook-card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
      onClick={() => onOpen(notebook)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = 'var(--paper-shadow)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.04)';
      }}
    >
      {/* Notebook Cover Illustration */}
      <div
        className={getTextureClass()}
        style={{
          height: '168px',
          backgroundColor: notebook.coverColor || '#1d4ed8',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Physical Notebook Spine & Stitching Details */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '22px',
            backgroundColor: 'rgba(0, 0, 0, 0.26)',
            borderRight: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: 'inset -2px 0 6px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '12px 0',
          }}
        >
          {/* Thread stitch marks */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.35)',
                borderRadius: '1px',
              }}
            />
          ))}
        </div>

        {/* Embossed Paper Label Plate */}
        <div
          style={{
            width: '80%',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(0,0,0,0.06)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginLeft: '12px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#1c1917',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}
          >
            {notebook.title}
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#78716c',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'capitalize',
            }}
          >
            <BookOpen size={11} />
            {notebook.defaultTemplate.type} paper
          </div>
        </div>
      </div>

      {/* Info Body */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
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

        {/* Action Menu */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            aria-label="Notebook options"
          >
            <MoreVertical size={16} />
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
                  top: '100%',
                  marginTop: '4px',
                  width: '130px',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(notebook);
                  }}
                  style={{
                    padding: '8px 10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    justifyContent: 'flex-start',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Edit2 size={13} />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(notebook);
                  }}
                  style={{
                    padding: '8px 10px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                    justifyContent: 'flex-start',
                    color: 'var(--danger)',
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
