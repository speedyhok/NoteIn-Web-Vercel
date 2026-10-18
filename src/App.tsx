import { useState, useEffect } from 'react';
import type { Notebook, PaperTemplate } from './types';
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
    if (activeNotebook) {
      const refreshedActive = loaded.find((nb) => nb.id === activeNotebook.id);
      if (refreshedActive) {
        setActiveNotebook(refreshedActive);
      }
    }
  };

  const handleCreateNotebook = async (
    title: string,
    color: string,
    coverPattern: Notebook['coverPattern'] = 'solid',
    template: PaperTemplate
  ) => {
    const { notebook } = await db.createNotebook(title, color, coverPattern, template);
    await refreshNotebooks();
    setActiveNotebook(notebook);
  };

  const handleRenameNotebook = async (notebookId: string, newTitle: string) => {
    await db.updateNotebookTitle(notebookId, newTitle);
    await refreshNotebooks();
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    await db.deleteNotebook(notebookId);
    if (activeNotebook?.id === notebookId) {
      setActiveNotebook(null);
    }
    await refreshNotebooks();
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {activeNotebook ? (
        <NoteEditor
          notebook={activeNotebook}
          onBack={() => {
            setActiveNotebook(null);
            refreshNotebooks();
          }}
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
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />
      )}
    </div>
  );
}

export default App;
