import React, { useState, useMemo } from 'react';
import type { Notebook, PaperTemplate } from '../../types';
import { NotebookCard } from './NotebookCard';
import { CreateNotebookModal } from './CreateNotebookModal';
import { Modal } from '../common/Modal';
import { GoogleDriveModal } from '../cloud/GoogleDriveModal';
import { ImportDocumentModal } from './ImportDocumentModal';
import { getGoogleUser } from '../../services/googleDriveService';
import type { GoogleUser } from '../../types';
import {
  Plus,
  Search,
  Book,
  Sun,
  Moon,
  Sparkles,
  ArrowUpDown,
  Upload,
} from 'lucide-react';

interface NotebookLibraryProps {
  notebooks: Notebook[];
  onOpenNotebook: (notebook: Notebook) => void;
  onCreateNotebook: (
    title: string,
    coverColor: string,
    coverPattern: Notebook['coverPattern'],
    template: PaperTemplate,
    orientation: import("../../types").PageOrientation
  ) => void;
  onRenameNotebook: (id: string, newTitle: string) => void;
  onDeleteNotebook: (id: string) => void;
  onImportNotebook?: (notebook: Notebook) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

type SortBy = 'updatedAt' | 'title' | 'pageCount';

export const NotebookLibrary: React.FC<NotebookLibraryProps> = ({
  notebooks,
  onOpenNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onImportNotebook,
  isDarkMode,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('updatedAt');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => getGoogleUser());


  // Filter & Sort
  const filteredNotebooks = useMemo(() => {
    return notebooks
      .filter((nb) => {
        const matchesQuery = nb.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const matchesTemplate = templateFilter === 'all' || nb.defaultTemplate.type === templateFilter;
        return matchesQuery && matchesTemplate;
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'pageCount') {
          return (b.pageCount || 1) - (a.pageCount || 1);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [notebooks, searchQuery, sortBy, templateFilter]);

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
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Editorial Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '24px 36px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Logo & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px var(--accent-glow)',
              }}
            >
              <Book size={22} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                NoteIn Studio
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Web
                </span>
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Your personal sanctuary for ideas, sketches, and thoughtful notes
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Input */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '9px 14px 9px 36px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '220px',
                  outline: 'none',
                  transition: 'border-color 0.15s, width 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
              />
            </div>

            {/* Google Drive Cloud Sync Button */}
            <button
              onClick={() => {
                setGoogleUser(getGoogleUser());
                setIsDriveOpen(true);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                backgroundColor: googleUser ? "rgba(37, 99, 235, 0.1)" : "var(--bg-tertiary)",
                border: googleUser ? "1px solid rgba(37, 99, 235, 0.3)" : "1px solid var(--border-subtle)",
                color: googleUser ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
              title="Google Drive Cloud Sync & Login"
            >
              {googleUser ? (
                <>
                  <img
                    src={googleUser.picture}
                    alt={googleUser.name}
                    style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <span>Google Drive</span>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#16a34a" }} />
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google Drive</span>
                </>
              )}
            </button>

            {/* Upload & Import Document Button */}
            <button
              onClick={() => setIsImportOpen(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Import PDF, NoteIn (.notein/.in), Images, or Markdown"
            >
              <Upload size={15} color="var(--accent-primary)" />
              <span>Import</span>
            </button>

            {/* Theme Switcher */}
            <button
              onClick={onToggleTheme}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Create Notebook CTA */}
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
            >
              <Plus size={16} />
              New Notebook
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ padding: '32px 36px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        {/* Controls Bar: Filter Chips & Sort Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '26px',
          }}
        >
          {/* Template Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'ruled', 'grid', 'dotted', 'cornell', 'blank'].map((t) => (
              <button
                key={t}
                onClick={() => setTemplateFilter(t)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  backgroundColor: templateFilter === t ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: templateFilter === t ? '#ffffff' : 'var(--text-secondary)',
                  border: templateFilter === t ? '1px solid transparent' : '1px solid var(--border-subtle)',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={14} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="updatedAt">Sort: Last Modified</option>
              <option value="title">Sort: Title (A-Z)</option>
              <option value="pageCount">Sort: Page Count</option>
            </select>
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
          /* Refined Empty State */
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
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {searchQuery ? 'No matching notebooks' : 'Your studio is waiting'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '380px', marginBottom: '20px' }}>
              {searchQuery
                ? `No notebooks match "${searchQuery}". Try a different keyword or reset filters.`
                : 'Create your first notebook to begin taking handwritten notes, typing thoughts, and sketching on paper.'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              style={{
                padding: '10px 22px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 600,
                boxShadow: '0 4px 14px var(--accent-glow)',
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
          Are you sure you want to permanently delete <strong>{deletingNotebook?.title}</strong>? All pages, handwriting, and text notes will be permanently removed.
        </p>
      </Modal>

      {/* Google Drive Cloud Sync & Login Modal */}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => {
          setIsDriveOpen(false);
          setGoogleUser(getGoogleUser());
        }}
        onImportComplete={(imported) => {
          if (onImportNotebook) {
            onImportNotebook(imported);
          } else {
            onOpenNotebook(imported);
          }
        }}
      />

      {/* Upload & Import Document Modal */}
      <ImportDocumentModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={(imported) => {
          if (onImportNotebook) {
            onImportNotebook(imported);
          } else {
            onOpenNotebook(imported);
          }
        }}
      />

    </div>
  );
};
