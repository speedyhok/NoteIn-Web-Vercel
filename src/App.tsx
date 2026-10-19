import { useState, useEffect } from 'react';
import type { Notebook, PaperTemplate, PageOrientation } from './types';
import * as db from './db';
import { NotebookLibrary } from './components/library/NotebookLibrary';
import { NoteEditor } from './components/editor/NoteEditor';
import { NoteinSplashScreen } from './components/common/NoteinSplashScreen';

export function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('notein_active_folder_id') || null;
    } catch {
      return null;
    }
  });
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashFading, setIsSplashFading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const handleSelectFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    try {
      if (folderId) {
        localStorage.setItem('notein_active_folder_id', folderId);
      } else {
        localStorage.removeItem('notein_active_folder_id');
      }
    } catch {}
  };

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Initial Load & DB Seed
  useEffect(() => {
    const init = async () => {
      const startTime = Date.now();
      await db.initDefaultData();
      const loaded = await db.getNotebooks();
      setNotebooks(loaded);

      // Keep splash visible for minimum smooth opening animation, then fade out
      const elapsed = Date.now() - startTime;
      const minDisplayMs = 850;
      const delay = Math.max(0, minDisplayMs - elapsed);

      setTimeout(() => {
        setIsSplashFading(true);
        setTimeout(() => {
          setShowSplash(false);
        }, 450);
      }, delay);
    };
    init();
  }, []);

  const refreshNotebooks = async () => {
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
    setActiveNotebook((prevActive) => {
      if (!prevActive) return null;
      const found = loaded.find((nb) => nb.id === prevActive.id);
      return found || null;
    });
  };

  const handleCreateNotebook = async (
    title: string,
    color: string,
    coverPattern: Notebook['coverPattern'] = 'solid',
    template: PaperTemplate,
    orientation: PageOrientation = 'portrait',
    folderId?: string | null
  ) => {
    const targetFolderId = folderId !== undefined ? folderId : currentFolderId;
    const { notebook } = await db.createNotebook(title, color, coverPattern, template, orientation, targetFolderId);
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
    setActiveNotebook(notebook);
  };

  const handleRenameNotebook = async (notebookId: string, newTitle: string) => {
    await db.updateNotebookTitle(notebookId, newTitle);
    await refreshNotebooks();
  };

    const handleMoveNotebookToFolder = async (notebookId: string, folderId: string | null) => {
    await db.moveNotebookToFolder(notebookId, folderId);
    await refreshNotebooks();
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    await db.deleteNotebook(notebookId);
    setActiveNotebook((prev) => (prev?.id === notebookId ? null : prev));
    await refreshNotebooks();
  };

  const handleOpenNotebook = (nb: Notebook) => {
    if (nb.folderId !== undefined) {
      handleSelectFolder(nb.folderId);
    }
    setActiveNotebook(nb);
  };

  const handleImportNotebook = async (importedNotebook: Notebook) => {
    if (currentFolderId && !importedNotebook.folderId) {
      await db.moveNotebookToFolder(importedNotebook.id, currentFolderId);
      importedNotebook.folderId = currentFolderId;
    }
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
    setActiveNotebook(importedNotebook);
  };

  const handleBackToLibrary = async () => {
    const returnFolderId = activeNotebook?.folderId !== undefined ? activeNotebook.folderId : currentFolderId;
    setActiveNotebook(null);
    handleSelectFolder(returnFolderId);
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {showSplash && <NoteinSplashScreen isFadingOut={isSplashFading} />}
      {activeNotebook ? (
        <NoteEditor
          notebook={activeNotebook}
          onBack={handleBackToLibrary}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      ) : (
        <NotebookLibrary
          notebooks={notebooks}
          currentFolderId={currentFolderId}
          onSelectFolder={handleSelectFolder}
          onOpenNotebook={handleOpenNotebook}
          onCreateNotebook={handleCreateNotebook}
          onRenameNotebook={handleRenameNotebook}
          onDeleteNotebook={handleDeleteNotebook}
          onMoveNotebookToFolder={handleMoveNotebookToFolder}
          onImportNotebook={handleImportNotebook}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      )}
    </div>
  );
}

export default App;
