import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Notebook, Page, Stroke, ToolType, ViewportTransform, PaperTemplate } from '../../types';
import { Toolbar } from './Toolbar';
import { PaperCanvas } from './PaperCanvas';
import { PageDrawer } from './PageDrawer';
import { HistoryManager } from '../../engine/history';
import { fitPageToContainer } from '../../engine/transform';
import * as db from '../../db';

interface NoteEditorProps {
  notebook: Notebook;
  onBack: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  notebook,
  onBack,
  isDarkMode,
  onToggleTheme,
}) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#1d4ed8');
  const [currentWidth, setCurrentWidth] = useState<number>(3.5);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPageDrawerOpen, setIsPageDrawerOpen] = useState<boolean>(false);

  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
  });

  const historyRef = useRef<HistoryManager>(new HistoryManager(50));
  const saveTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPage = pages[currentPageIndex] || null;

  // 1. Initial Load: Fetch pages for notebook
  useEffect(() => {
    let isMounted = true;
    db.getPagesForNotebook(notebook.id).then((loadedPages) => {
      if (isMounted) {
        setPages(loadedPages);
        setCurrentPageIndex(0);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [notebook.id]);

  // 2. Load Strokes whenever Current Page changes
  useEffect(() => {
    if (!currentPage) return;
    let isMounted = true;

    // Reset history stack for the new page
    historyRef.current.clear();

    db.getStrokesForPage(currentPage.id).then((loadedStrokes) => {
      if (isMounted) {
        setStrokes(loadedStrokes);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentPage?.id]);

  // 3. Auto-fit Page on Initial Mount and Window Resize
  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !currentPage) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const newTransform = fitPageToContainer(
      currentPage.width,
      currentPage.height,
      clientWidth,
      clientHeight,
      40
    );
    setTransform(newTransform);
  }, [currentPage]);

  useEffect(() => {
    handleFitPage();
    window.addEventListener('resize', handleFitPage);
    return () => window.removeEventListener('resize', handleFitPage);
  }, [handleFitPage]);

  // 4. Debounced Autosave of Strokes to IndexedDB
  const triggerAutosave = useCallback((pageId: string, updatedStrokes: Stroke[]) => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    setIsSaving(true);

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await db.saveStrokesForPage(pageId, updatedStrokes);
      } catch (err) {
        console.error('Failed to autosave strokes:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, []);

  // 5. Stroke Actions
  const handleAddStroke = (stroke: Stroke) => {
    if (!currentPage) return;
    const updated = [...strokes, stroke];
    setStrokes(updated);
    historyRef.current.push({ type: 'ADD_STROKE', stroke });
    triggerAutosave(currentPage.id, updated);
  };

  const handleDeleteStrokes = (deletedStrokes: Stroke[]) => {
    if (!currentPage || deletedStrokes.length === 0) return;
    const deletedIds = new Set(deletedStrokes.map((s) => s.id));
    const updated = strokes.filter((s) => !deletedIds.has(s.id));
    setStrokes(updated);
    historyRef.current.push({ type: 'DELETE_STROKES', strokes: deletedStrokes });
    triggerAutosave(currentPage.id, updated);
  };

  // 6. Undo / Redo
  const handleUndo = () => {
    if (!currentPage || !historyRef.current.canUndo()) return;
    const result = historyRef.current.undo(strokes);
    setStrokes(result.strokes);
    triggerAutosave(currentPage.id, result.strokes);
  };

  const handleRedo = () => {
    if (!currentPage || !historyRef.current.canRedo()) return;
    const result = historyRef.current.redo(strokes);
    setStrokes(result.strokes);
    triggerAutosave(currentPage.id, result.strokes);
  };

  // 7. Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Space for Pan, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Redo
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
      // 1-4 for Tools
      else if (e.key === '1') setActiveTool('pen');
      else if (e.key === '2') setActiveTool('highlighter');
      else if (e.key === '3') setActiveTool('eraser');
      else if (e.key === '4' || e.code === 'Space') setActiveTool('pan');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // 8. Page Operations
  const handleAddPage = async () => {
    const newPage = await db.createPage(notebook.id, currentPage?.template);
    const updatedPages = await db.getPagesForNotebook(notebook.id);
    setPages(updatedPages);
    const newIndex = updatedPages.findIndex((p) => p.id === newPage.id);
    setCurrentPageIndex(newIndex >= 0 ? newIndex : updatedPages.length - 1);
  };

  const handleDuplicatePage = async (pageId: string) => {
    const duplicated = await db.duplicatePage(pageId);
    if (!duplicated) return;
    const updatedPages = await db.getPagesForNotebook(notebook.id);
    setPages(updatedPages);
    const targetIndex = updatedPages.findIndex((p) => p.id === duplicated.id);
    if (targetIndex >= 0) setCurrentPageIndex(targetIndex);
  };

  const handleDeletePage = async (pageId: string) => {
    const success = await db.deletePage(pageId);
    if (!success) return;
    const updatedPages = await db.getPagesForNotebook(notebook.id);
    setPages(updatedPages);
    if (currentPageIndex >= updatedPages.length) {
      setCurrentPageIndex(Math.max(0, updatedPages.length - 1));
    }
  };

  const handleChangeTemplate = async (newTemplate: PaperTemplate) => {
    if (!currentPage) return;
    await db.updatePageTemplate(currentPage.id, newTemplate);
    const updated = await db.getPagesForNotebook(notebook.id);
    setPages(updated);
  };

  // Zoom Helpers
  const handleZoomIn = () => {
    setTransform((prev) => ({ ...prev, zoom: Math.min(5.0, prev.zoom * 1.2) }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({ ...prev, zoom: Math.max(0.25, prev.zoom / 1.2) }));
  };

  const handleResetZoom = () => {
    setTransform((prev) => ({ ...prev, zoom: 1.0 }));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-canvas-outer)',
      }}
    >
      {/* Floating Frosted Glass Toolbar */}
      {currentPage && (
        <Toolbar
          notebookTitle={notebook.title}
          onBack={onBack}
          activeTool={activeTool}
          onChangeTool={setActiveTool}
          currentColor={currentColor}
          onChangeColor={setCurrentColor}
          currentWidth={currentWidth}
          onChangeWidth={setCurrentWidth}
          canUndo={historyRef.current.canUndo()}
          canRedo={historyRef.current.canRedo()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoom={transform.zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onFitPage={handleFitPage}
          currentPageIndex={currentPageIndex}
          totalPages={pages.length}
          onPrevPage={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
          onNextPage={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
          onAddPage={handleAddPage}
          onTogglePageDrawer={() => setIsPageDrawerOpen(!isPageDrawerOpen)}
          currentTemplate={currentPage.template}
          onChangeTemplate={handleChangeTemplate}
          isSaving={isSaving}
          isDarkMode={isDarkMode}
          onToggleTheme={onToggleTheme}
        />
      )}

      {/* Main Responsive Canvas Surface */}
      {currentPage ? (
        <PaperCanvas
          page={currentPage}
          strokes={strokes}
          activeTool={activeTool}
          currentColor={currentColor}
          currentWidth={currentWidth}
          transform={transform}
          onTransformChange={setTransform}
          onAddStroke={handleAddStroke}
          onDeleteStrokes={handleDeleteStrokes}
          isDarkMode={isDarkMode}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          Loading page...
        </div>
      )}

      {/* Slide-out Page Thumbnails Drawer */}
      <PageDrawer
        isOpen={isPageDrawerOpen}
        onClose={() => setIsPageDrawerOpen(false)}
        pages={pages}
        currentPageIndex={currentPageIndex}
        onSelectPage={setCurrentPageIndex}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
      />
    </div>
  );
};
