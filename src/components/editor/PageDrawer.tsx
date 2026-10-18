import React from 'react';
import { X, Plus, Copy, Trash2 } from 'lucide-react';
import type { Page } from '../../types';

interface PageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

export const PageDrawer: React.FC<PageDrawerProps> = ({
  isOpen,
  onClose,
  pages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          maxWidth: '85vw',
          zIndex: 90,
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
          animation: 'fadeIn 0.2s ease-out forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Page Overview
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thumbnail Page List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {pages.map((p, idx) => {
            const isCurrent = idx === currentPageIndex;
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  onClick={() => {
                    onSelectPage(idx);
                    onClose();
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '794 / 1123',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: p.template.bgColor || '#ffffff',
                    border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                    boxShadow: isCurrent ? '0 0 0 3px var(--accent-light)' : '0 2px 6px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = 'var(--border-strong)';
                  }}
                >
                  {/* Miniature template indication */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {p.template.type}
                  </div>

                  {/* Page number badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isCurrent ? 'var(--accent-primary)' : 'rgba(0, 0, 0, 0.55)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {idx + 1}
                  </div>
                </div>

                {/* Page Action Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Page {idx + 1}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => onDuplicatePage(p.id)}
                      style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                      title="Duplicate Page"
                    >
                      <Copy size={13} />
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={() => onDeletePage(p.id)}
                        style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--danger)' }}
                        title="Delete Page"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Page Footer Button */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <button
            onClick={() => {
              onAddPage();
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 2px 8px var(--accent-glow)',
            }}
          >
            <Plus size={16} />
            Insert New Page
          </button>
        </div>
      </div>
    </>
  );
};
