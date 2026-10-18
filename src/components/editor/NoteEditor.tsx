import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Notebook, Page, Stroke, TextBox, ToolType, ViewportTransform, PaperTemplate } from '../../types';
import * as db from '../../db';
import { fitPageToContainer } from '../../engine/transform';
import { HistoryManager } from '../../engine/history';
import { Toolbar } from './Toolbar';
import { PaperCanvas } from './PaperCanvas';
import { PageDrawer } from './PageDrawer';

interface NoteEditorProps {
  notebook: Notebook;
  initialPageId?: string;
  onBack: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  notebook,
  initialPageId,
  onBack,
  isDarkMode,
  onToggleTheme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pages State
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isPageDrawerOpen, setIsPageDrawerOpen] = useState(false);

  // Drawing State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#1e40af');
  const [currentWidth, setCurrentWidth] = useState<number>(3);

  // Text formatting State
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('Inter, sans-serif');
  const [currentFontSize, setCurrentFontSize] = useState<number>(16);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');

  // Text Selection State
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);

  // Reactive History State
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef<HistoryManager>(new HistoryManager(50));

  // Viewport Transform (Zoom & Pan)
  const [transform, setTransform] = useState<ViewportTransform>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
  });

  // Autosave status
  const [isSaving, setIsSaving] = useState(false);
  const saveStrokesTimeoutRef = useRef<number | null>(null);
  const saveTextBoxesTimeoutRef = useRef<number | null>(null);

  // Current Page Derived
  const currentPage = pages[currentPageIndex] || null;

  // Subscribe to HistoryManager changes for reactive undo/redo state
  useEffect(() => {
    const unsubscribe = historyRef.current.subscribe((undoable, redoable) => {
      setCanUndo(undoable);
      setCanRedo(redoable);
    });
    return unsubscribe;
  }, []);

  // 1. Load Notebook Pages
  useEffect(() => {
    let isMounted = true;
    db.getPagesForNotebook(notebook.id).then((loadedPages) => {
      if (!isMounted) return;
      if (loadedPages.length === 0) {
        db.createPage(notebook.id).then((newPage) => {
          if (isMounted) {
            setPages([newPage]);
            setCurrentPageIndex(0);
          }
        });
      } else {
        setPages(loadedPages);
        if (initialPageId) {
          const idx = loadedPages.findIndex((p) => p.id === initialPageId);
          setCurrentPageIndex(idx >= 0 ? idx : 0);
        } else {
          setCurrentPageIndex(0);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [notebook.id, initialPageId]);

  // 2. Load Strokes and TextBoxes for Active Page
  useEffect(() => {
    if (!currentPage) return;
    let isMounted = true;

    // Reset history stack for the new page so actions don't affect other pages
    historyRef.current.clear();
    setSelectedTextBoxId(null);
    setEditingTextBoxId(null);

    Promise.all([
      db.getStrokesForPage(currentPage.id),
      db.getTextBoxesForPage(currentPage.id),
    ]).then(([loadedStrokes, loadedTextBoxes]) => {
      if (isMounted) {
        setStrokes(loadedStrokes);
        setTextBoxes(loadedTextBoxes);
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
      80 // padding for top bars
    );
    // Center with vertical offset for toolbar
    setTransform({
      ...newTransform,
      panY: Math.max(50, newTransform.panY),
    });
  }, [currentPage]);

  useEffect(() => {
    handleFitPage();
    window.addEventListener('resize', handleFitPage);
    return () => window.removeEventListener('resize', handleFitPage);
  }, [handleFitPage]);

  // 4. Debounced Autosave Handlers
  const triggerAutosaveStrokes = useCallback((pageId: string, updatedStrokes: Stroke[]) => {
    if (saveStrokesTimeoutRef.current) {
      window.clearTimeout(saveStrokesTimeoutRef.current);
    }
    setIsSaving(true);

    saveStrokesTimeoutRef.current = window.setTimeout(async () => {
      try {
        await db.saveStrokesForPage(pageId, updatedStrokes);
      } catch (err) {
        console.error('Failed to autosave strokes:', err);
      } finally {
        setIsSaving(false);
      }
    }, 400);
  }, []);

  const triggerAutosaveTextBoxes = useCallback((pageId: string, updatedTextBoxes: TextBox[]) => {
    if (saveTextBoxesTimeoutRef.current) {
      window.clearTimeout(saveTextBoxesTimeoutRef.current);
    }
    setIsSaving(true);

    saveTextBoxesTimeoutRef.current = window.setTimeout(async () => {
      try {
        await db.saveTextBoxesForPage(pageId, updatedTextBoxes);
      } catch (err) {
        console.error('Failed to autosave text boxes:', err);
      } finally {
        setIsSaving(false);
      }
    }, 400);
  }, []);

  // 5. Stroke Operations
  const handleAddStroke = (stroke: Stroke) => {
    if (!currentPage) return;
    const updated = [...strokes, stroke];
    setStrokes(updated);
    historyRef.current.push({ type: 'ADD_STROKE', stroke });
    triggerAutosaveStrokes(currentPage.id, updated);
  };

  const handleStrokesLiveUpdate = (updatedStrokes: Stroke[]) => {
    setStrokes(updatedStrokes);
  };

  const handleDeleteStrokesCommit = (deletedStrokes: Stroke[]) => {
    if (!currentPage || deletedStrokes.length === 0) return;
    const deletedIds = new Set(deletedStrokes.map((s) => s.id));
    const updated = strokes.filter((s) => !deletedIds.has(s.id));
    setStrokes(updated);
    historyRef.current.push({ type: 'DELETE_STROKES', strokes: deletedStrokes });
    triggerAutosaveStrokes(currentPage.id, updated);
  };

  // 6. Text Box Operations
  const handleCreateTextBox = (x: number, y: number) => {
    if (!currentPage) return;
    const newBox: TextBox = {
      id: crypto.randomUUID(),
      pageId: currentPage.id,
      x,
      y,
      width: 240,
      height: 54,
      content: '',
      fontFamily: currentFontFamily,
      fontSize: currentFontSize,
      color: currentColor,
      bold: isBold,
      italic: isItalic,
      alignment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...textBoxes, newBox];
    setTextBoxes(updated);
    setSelectedTextBoxId(newBox.id);
    setEditingTextBoxId(newBox.id);
    historyRef.current.push({ type: 'ADD_TEXT_BOX', textBox: newBox });
    triggerAutosaveTextBoxes(currentPage.id, updated);
  };

  const handleEndEditingTextBox = (id: string, newContent: string) => {
    setEditingTextBoxId(null);
    if (!currentPage) return;

    const existing = textBoxes.find((t) => t.id === id);
    if (!existing) return;

    

    if (existing.content !== newContent) {
      const updatedBox: TextBox = {
        ...existing,
        content: newContent,
        updatedAt: Date.now(),
      };
      const updatedList = textBoxes.map((t) => (t.id === id ? updatedBox : t));
      setTextBoxes(updatedList);
      historyRef.current.push({
        type: 'UPDATE_TEXT_BOX',
        prev: existing,
        current: updatedBox,
      });
      triggerAutosaveTextBoxes(currentPage.id, updatedList);
    }
  };

  const handleUpdateTextBoxPosition = (id: string, newX: number, newY: number) => {
    setTextBoxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, x: newX, y: newY } : t))
    );
  };

  const handleCommitTextBoxPosition = (
    id: string,
    oldX: number,
    oldY: number,
    newX: number,
    newY: number
  ) => {
    if (!currentPage) return;
    const target = textBoxes.find((t) => t.id === id);
    if (!target) return;

    const prevBox: TextBox = { ...target, x: oldX, y: oldY };
    const currentBox: TextBox = { ...target, x: newX, y: newY, updatedAt: Date.now() };

    historyRef.current.push({
      type: 'UPDATE_TEXT_BOX',
      prev: prevBox,
      current: currentBox,
    });
    triggerAutosaveTextBoxes(currentPage.id, textBoxes);
  };

  const handleUpdateTextBoxSize = (id: string, newW: number, newH: number) => {
    setTextBoxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, width: newW, height: newH } : t))
    );
  };

  const handleCommitTextBoxSize = (
    id: string,
    oldW: number,
    oldH: number,
    newW: number,
    newH: number
  ) => {
    if (!currentPage) return;
    const target = textBoxes.find((t) => t.id === id);
    if (!target) return;

    const prevBox: TextBox = { ...target, width: oldW, height: oldH };
    const currentBox: TextBox = { ...target, width: newW, height: newH, updatedAt: Date.now() };

    historyRef.current.push({
      type: 'UPDATE_TEXT_BOX',
      prev: prevBox,
      current: currentBox,
    });
    triggerAutosaveTextBoxes(currentPage.id, textBoxes);
  };

  const handleDeleteTextBox = (id: string) => {
    if (!currentPage) return;
    const target = textBoxes.find((t) => t.id === id);
    if (!target) return;

    const updated = textBoxes.filter((t) => t.id !== id);
    setTextBoxes(updated);
    setSelectedTextBoxId(null);
    setEditingTextBoxId(null);
    historyRef.current.push({ type: 'DELETE_TEXT_BOX', textBox: target });
    triggerAutosaveTextBoxes(currentPage.id, updated);
  };

  // Format updates for selected text box
  const applyTextFormatting = (key: keyof TextBox, value: any) => {
    if (!selectedTextBoxId || !currentPage) return;
    const target = textBoxes.find((t) => t.id === selectedTextBoxId);
    if (!target) return;

    const updatedBox: TextBox = {
      ...target,
      [key]: value,
      updatedAt: Date.now(),
    };
    const updatedList = textBoxes.map((t) => (t.id === selectedTextBoxId ? updatedBox : t));
    setTextBoxes(updatedList);
    historyRef.current.push({
      type: 'UPDATE_TEXT_BOX',
      prev: target,
      current: updatedBox,
    });
    triggerAutosaveTextBoxes(currentPage.id, updatedList);
  };

  // 7. Undo / Redo
  const handleUndo = useCallback(() => {
    if (!currentPage || !historyRef.current.canUndo()) return;
    const result = historyRef.current.undo({ strokes, textBoxes });
    setStrokes(result.strokes);
    setTextBoxes(result.textBoxes);
    triggerAutosaveStrokes(currentPage.id, result.strokes);
    triggerAutosaveTextBoxes(currentPage.id, result.textBoxes);
  }, [currentPage, strokes, textBoxes, triggerAutosaveStrokes, triggerAutosaveTextBoxes]);

  const handleRedo = useCallback(() => {
    if (!currentPage || !historyRef.current.canRedo()) return;
    const result = historyRef.current.redo({ strokes, textBoxes });
    setStrokes(result.strokes);
    setTextBoxes(result.textBoxes);
    triggerAutosaveStrokes(currentPage.id, result.strokes);
    triggerAutosaveTextBoxes(currentPage.id, result.textBoxes);
  }, [currentPage, strokes, textBoxes, triggerAutosaveStrokes, triggerAutosaveTextBoxes]);

  // 8. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      // Do not intercept shortcuts inside active text input/editor
      if (isInput) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Delete selected text box
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextBoxId) {
        e.preventDefault();
        handleDeleteTextBox(selectedTextBoxId);
      }
      // Tool Hotkeys
      else if (e.key === '1') setActiveTool('pen');
      else if (e.key === '2') setActiveTool('highlighter');
      else if (e.key === '3') setActiveTool('eraser');
      else if (e.key === '4') setActiveTool('text');
      else if (e.key === '5' || e.code === 'Space') setActiveTool('pan');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedTextBoxId]);

  // 9. Page Operations
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
      {/* Top Header & Floating Studio Toolbar */}
      {currentPage && (
        <Toolbar
          notebookTitle={notebook.title}
          onBack={onBack}
          activeTool={activeTool}
          onChangeTool={setActiveTool}
          currentColor={currentColor}
          onChangeColor={(color) => {
            setCurrentColor(color);
            applyTextFormatting('color', color);
          }}
          currentWidth={currentWidth}
          onChangeWidth={setCurrentWidth}
          currentFontFamily={currentFontFamily}
          onChangeFontFamily={(font) => {
            setCurrentFontFamily(font);
            applyTextFormatting('fontFamily', font);
          }}
          currentFontSize={currentFontSize}
          onChangeFontSize={(size) => {
            setCurrentFontSize(size);
            applyTextFormatting('fontSize', size);
          }}
          isBold={isBold}
          onToggleBold={() => {
            const next = !isBold;
            setIsBold(next);
            applyTextFormatting('bold', next);
          }}
          isItalic={isItalic}
          onToggleItalic={() => {
            const next = !isItalic;
            setIsItalic(next);
            applyTextFormatting('italic', next);
          }}
          alignment={alignment}
          onChangeAlignment={(align) => {
            setAlignment(align);
            applyTextFormatting('alignment', align);
          }}
          canUndo={canUndo}
          canRedo={canRedo}
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

      {/* Main Responsive Canvas & Text Surface */}
      {currentPage ? (
        <PaperCanvas
          page={currentPage}
          strokes={strokes}
          textBoxes={textBoxes}
          activeTool={activeTool}
          currentColor={currentColor}
          currentWidth={currentWidth}
          transform={transform}
          onTransformChange={setTransform}
          onAddStroke={handleAddStroke}
          onStrokesLiveUpdate={handleStrokesLiveUpdate}
          onDeleteStrokesCommit={handleDeleteStrokesCommit}
          onCreateTextBox={handleCreateTextBox}
          selectedTextBoxId={selectedTextBoxId}
          editingTextBoxId={editingTextBoxId}
          onSelectTextBox={setSelectedTextBoxId}
          onStartEditingTextBox={(id) => {
            setSelectedTextBoxId(id);
            setEditingTextBoxId(id);
          }}
          onEndEditingTextBox={handleEndEditingTextBox}
          onUpdateTextBoxPosition={handleUpdateTextBoxPosition}
          onCommitTextBoxPosition={handleCommitTextBoxPosition}
          onUpdateTextBoxSize={handleUpdateTextBoxSize}
          onCommitTextBoxSize={handleCommitTextBoxSize}
          onDeleteTextBox={handleDeleteTextBox}
          isDarkMode={isDarkMode}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
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
