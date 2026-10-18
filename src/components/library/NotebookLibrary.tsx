import React, { useState } from 'react';
import { Plus, Search, Moon, Sun, BookMarked, Sparkles } from 'lucide-react';
import type { Notebook, PaperTemplate } from '../../types';
import { NotebookCard } from './NotebookCard';
import { CreateNotebookModal } from './CreateNotebookModal';
import { Modal } from '../common/Modal';

interface NotebookLibraryProps {
  notebooks: Notebook[];
  onOpenNotebook: (notebook: Notebook) => void;
  onCreateNotebook: (title: string, color: string, template: PaperTemplate) => void;
  onRenameNotebook: (notebookId: string, newTitle: string) => void;
  onDeleteNotebook: (notebookId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const NotebookLibrary: React.FC<NotebookLibraryProps> = ({
  notebooks,
  onOpenNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  isDarkMode,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const filteredNotebooks = notebooks.filter((nb) =>
    nb.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleStartRename = (nb: Notebook) => {
    setEditingNotebook(nb);
    setNewTitle(nb.title);
  };

  const handleConfirmRename = () => {
    if (editingNotebook && newTitle.trim()) {
      onRenameNotebook(editingNotebook.id, newTitle.trim());
      setEditingNotebook(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingNotebook) {
      onDeleteNotebook(deletingNotebook.id);
      setDeletingNotebook(null);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Top Navigation Bar */}
      <header
        className="glass-panel"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px var(--accent-glow)',
            }}
          >
            <BookMarked size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              NoteIn
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Digital Notebook &amp; Hand-Drawn Notes
            </span>
          </div>
        </div>

        {/* Center Search Input */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '340px',
            margin: '0 16px',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              transition: 'all var(--transition-fast)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-primary)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-strong)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* New Notebook CTA */}
          <button
            onClick={() => setIsCreateOpen(true)}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 4px 14px var(--accent-glow)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
          >
            <Plus size={16} />
            New Notebook
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main style={{ padding: '32px 36px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
              My Notebooks
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filteredNotebooks.length} {filteredNotebooks.length === 1 ? 'notebook' : 'notebooks'} stored in local offline IndexedDB
            </p>
          </div>
        </div>

        {/* Notebook Cards Grid */}
        {filteredNotebooks.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '24px',
            }}
          >
            {filteredNotebooks.map((nb) => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onOpen={onOpenNotebook}
                onRename={handleStartRename}
                onDelete={(target) => setDeletingNotebook(target)}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div
            className="animate-scale-up"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '2px dashed var(--border-strong)',
              marginTop: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {searchQuery ? 'No matching notebooks' : 'No notebooks yet'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '380px', marginBottom: '20px' }}>
              {searchQuery
                ? `No notebooks match "${searchQuery}". Try a different keyword.`
                : 'Create your first notebook to begin taking handwritten notes, sketching, and studying with digital paper.'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 600,
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}
            >
              <Plus size={16} />
              Create Your First Notebook
            </button>
          </div>
        )}
      </main>

      {/* Create Notebook Modal */}
      <CreateNotebookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={onCreateNotebook}
      />

      {/* Rename Notebook Modal */}
      <Modal
        isOpen={editingNotebook !== null}
        onClose={() => setEditingNotebook(null)}
        title="Rename Notebook"
        footer={
          <>
            <button
              onClick={() => setEditingNotebook(null)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRename}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            New Title
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRename();
            }}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingNotebook !== null}
        onClose={() => setDeletingNotebook(null)}
        title="Delete Notebook"
        footer={
          <>
            <button
              onClick={() => setDeletingNotebook(null)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Are you sure you want to permanently delete <strong>{deletingNotebook?.title}</strong>? All pages and handwriting will be permanently removed.
        </p>
      </Modal>
    </div>
  );
};
