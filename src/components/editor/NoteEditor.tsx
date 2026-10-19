import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Notebook, Page, Stroke, TextBox, ToolType, ViewportTransform, PaperTemplate, PageOrientation } from '../../types';
import * as db from '../../db';
import { fitPageToContainer, coverPageToContainer } from '../../engine/transform';
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
  const [currentColor, setCurrentColor] = useState<string>('#1d4ed8');
  const [currentWidth, setCurrentWidth] = useState<number>(3);

  // Text formatting State
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('Inter, sans-serif');
  const [currentFontSize, setCurrentFontSize] = useState<number>(16);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrikethrough, setIsStrikethrough] = useState<boolean>(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [currentTextBg, setCurrentTextBg] = useState<string>('transparent');

  // Text Selection State
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);

  // Reactive History State
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef<HistoryManager>(new HistoryManager(50));
  const [isCoverMode, setIsCoverMode] = useState<boolean>(true);

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
  const pageOrientation: PageOrientation =
    currentPage?.orientation || (currentPage && currentPage.width > currentPage.height ? 'landscape' : 'portrait');

  // Subscribe to HistoryManager changes for reactive undo/redo state
  useEffect(() => {
    const unsubscribe = historyRef.current.subscribe((undoable, redoable) => {
      setCanUndo(undoable);
      setCanRedo(redoable);
    });
    return unsubscribe;
  }, []);

  // Sync toolbar formatting with selected text box
  useEffect(() => {
    if (!selectedTextBoxId) return;
    const selectedBox = textBoxes.find((t) => t.id === selectedTextBoxId);
    if (selectedBox) {
      setCurrentFontFamily(selectedBox.fontFamily);
      setCurrentFontSize(selectedBox.fontSize);
      setIsBold(selectedBox.bold);
      setIsItalic(selectedBox.italic);
      setIsUnderline(!!selectedBox.underline);
      setIsStrikethrough(!!selectedBox.strikethrough);
      setAlignment(selectedBox.alignment || 'left');
      setCurrentTextBg(selectedBox.backgroundColor || 'transparent');
      setCurrentColor(selectedBox.color);
    }
  }, [selectedTextBoxId, textBoxes]);

  // 1. Load Notebook Pages
  useEffect(() => {
    let isMounted = true;
    db.getPagesForNotebook(notebook.id).then((loadedPages) => {
      if (!isMounted) return;
      if (loadedPages.length === 0) {
        db.createPage(notebook.id, undefined, notebook.orientation || 'portrait').then((newPage) => {
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
  }, [notebook.id, initialPageId, notebook.orientation]);

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

  // 3. Auto-fit / Cover Screen on Initial Mount, Window Resize, and Orientation change
  const handleFitPage = useCallback((forceMode?: boolean) => {
    if (!containerRef.current || !currentPage) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const nextMode = forceMode !== undefined ? forceMode : !isCoverMode;
    setIsCoverMode(nextMode);

    if (nextMode) {
      // Cover screen: page expands to fill and cover screen
      const newTransform = coverPageToContainer(
        currentPage.width,
        currentPage.height,
        clientWidth,
        clientHeight,
        50
      );
      setTransform(newTransform);
    } else {
      // Centered page overview
      const newTransform = fitPageToContainer(
        currentPage.width,
        currentPage.height,
        clientWidth,
        clientHeight,
        80
      );
      setTransform({
        ...newTransform,
        panY: Math.max(50, newTransform.panY),
      });
    }
  }, [currentPage, isCoverMode]);

  useEffect(() => {
    handleFitPage(true);
    const onResize = () => handleFitPage(isCoverMode);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [currentPage?.id]);

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
      underline: isUnderline,
      strikethrough: isStrikethrough,
      alignment,
      backgroundColor: currentTextBg,
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

    const cleanContent = (newContent === 'Click to edit...' || newContent === 'Click to edit') ? '' : newContent;
    if (existing.content !== cleanContent) {
      const updatedBox: TextBox = {
        ...existing,
        content: cleanContent,
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

  const handleToggleUnderline = () => {
    const next = !isUnderline;
    setIsUnderline(next);
    applyTextFormatting('underline', next);
  };

  const handleToggleStrikethrough = () => {
    const next = !isStrikethrough;
    setIsStrikethrough(next);
    applyTextFormatting('strikethrough', next);
  };

  const handleChangeTextBg = (bg: string) => {
    setCurrentTextBg(bg);
    applyTextFormatting('backgroundColor', bg);
  };

  const handleInsertBullet = () => {
    if (!selectedTextBoxId || !currentPage) return;
    const target = textBoxes.find((t) => t.id === selectedTextBoxId);
    if (!target) return;

    const lines = target.content.split('\n');
    const bulleted = lines.map((l) => (l.startsWith('• ') ? l.substring(2) : `• ${l}`)).join('\n');
    const updatedBox: TextBox = { ...target, content: bulleted, updatedAt: Date.now() };
    const updatedList = textBoxes.map((t) => (t.id === selectedTextBoxId ? updatedBox : t));
    setTextBoxes(updatedList);
    historyRef.current.push({ type: 'UPDATE_TEXT_BOX', prev: target, current: updatedBox });
    triggerAutosaveTextBoxes(currentPage.id, updatedList);
  };

  const handleInsertNumbered = () => {
    if (!selectedTextBoxId || !currentPage) return;
    const target = textBoxes.find((t) => t.id === selectedTextBoxId);
    if (!target) return;

    const lines = target.content.split('\n');
    const numbered = lines.map((l, i) => {
      const clean = l.replace(/^\d+\.\s*/, '');
      return `${i + 1}. ${clean}`;
    }).join('\n');
    const updatedBox: TextBox = { ...target, content: numbered, updatedAt: Date.now() };
    const updatedList = textBoxes.map((t) => (t.id === selectedTextBoxId ? updatedBox : t));
    setTextBoxes(updatedList);
    historyRef.current.push({ type: 'UPDATE_TEXT_BOX', prev: target, current: updatedBox });
    triggerAutosaveTextBoxes(currentPage.id, updatedList);
  };

  const handleDuplicateTextBox = (id?: string) => {
    const targetId = id || selectedTextBoxId;
    if (!targetId || !currentPage) return;
    const target = textBoxes.find((t) => t.id === targetId);
    if (!target) return;

    const cloned: TextBox = {
      ...target,
      id: crypto.randomUUID(),
      x: target.x + 24,
      y: target.y + 24,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedList = [...textBoxes, cloned];
    setTextBoxes(updatedList);
    setSelectedTextBoxId(cloned.id);
    historyRef.current.push({ type: 'ADD_TEXT_BOX', textBox: cloned });
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
  const handleToggleOrientation = async () => {
    if (!currentPage) return;
    const nextOrientation: PageOrientation = pageOrientation === 'portrait' ? 'landscape' : 'portrait';
    const updated = await db.updatePageOrientation(currentPage.id, nextOrientation);
    if (updated) {
      const updatedPages = await db.getPagesForNotebook(notebook.id);
      setPages(updatedPages);
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const newTransform = isCoverMode
          ? coverPageToContainer(updated.width, updated.height, clientWidth, clientHeight, 50)
          : fitPageToContainer(updated.width, updated.height, clientWidth, clientHeight, 80);
        setTransform({
          ...newTransform,
          panY: Math.max(50, newTransform.panY),
        });
      }
    }
  };

  const handleAddPage = async () => {
    const newPage = await db.createPage(notebook.id, currentPage?.template, pageOrientation);
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
          isUnderline={isUnderline}
          onToggleUnderline={handleToggleUnderline}
          isStrikethrough={isStrikethrough}
          onToggleStrikethrough={handleToggleStrikethrough}
          alignment={alignment}
          onChangeAlignment={(align) => {
            setAlignment(align);
            applyTextFormatting('alignment', align);
          }}
          currentTextBg={currentTextBg}
          onChangeTextBg={handleChangeTextBg}
          onInsertBullet={handleInsertBullet}
          onInsertNumbered={handleInsertNumbered}
          onDuplicateTextBox={handleDuplicateTextBox}
          pageOrientation={pageOrientation}
          onToggleOrientation={handleToggleOrientation}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoom={transform.zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onFitPage={() => handleFitPage()}
          isCoverMode={isCoverMode}
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
          onDuplicateTextBox={handleDuplicateTextBox}
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
