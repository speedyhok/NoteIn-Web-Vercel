import { useState, useEffect } from 'react';
import type { Notebook, PaperTemplate, PageOrientation } from './types';
import * as db from './db';
import { NotebookLibrary } from './components/library/NotebookLibrary';
import { NoteEditor } from './components/editor/NoteEditor';

export function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Initial Load & DB Seed
  useEffect(() => {
    const init = async () => {
      await db.initDefaultData();
      const loaded = await db.getNotebooks();
      setNotebooks(loaded);
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
    orientation: PageOrientation = 'portrait'
  ) => {
    const { notebook } = await db.createNotebook(title, color, coverPattern, template, orientation);
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
    setActiveNotebook(notebook);
  };

  const handleRenameNotebook = async (notebookId: string, newTitle: string) => {
    await db.updateNotebookTitle(notebookId, newTitle);
    await refreshNotebooks();
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    await db.deleteNotebook(notebookId);
    setActiveNotebook((prev) => (prev?.id === notebookId ? null : prev));
    await refreshNotebooks();
  };

  const handleImportNotebook = async (importedNotebook: Notebook) => {
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
    setActiveNotebook(importedNotebook);
  };

  const handleBackToLibrary = async () => {
    setActiveNotebook(null);
    const loaded = await db.getNotebooks();
    setNotebooks(loaded);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
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
          onOpenNotebook={(nb) => setActiveNotebook(nb)}
          onCreateNotebook={handleCreateNotebook}
          onRenameNotebook={handleRenameNotebook}
          onDeleteNotebook={handleDeleteNotebook}
          onImportNotebook={handleImportNotebook}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      )}
    </div>
  );
}

export default App;
