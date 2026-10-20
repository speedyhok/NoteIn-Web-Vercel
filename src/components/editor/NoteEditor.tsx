import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Notebook, Page, Stroke, TextBox, NoteImage, ToolType, ViewportTransform, PaperTemplate, PageOrientation } from '../../types';
import * as db from '../../db';
import { fitPageToContainer, coverPageToContainer } from '../../engine/transform';
import { detectCodeSnippet, highlightCodeToHtml } from '../../engine/syntaxHighlighter';
import { HistoryManager } from '../../engine/history';
import { exportNotebookAsNotein } from '../../services/documentImporter';
import { uploadNotebookToGoogleDrive } from '../../services/googleDriveService';
import { Toolbar } from './Toolbar';
import { PaperCanvas, type ShapeMode } from './PaperCanvas';
import { PageDrawer } from './PageDrawer';
import { FeatherLoader } from '../common/FeatherLoader';
import { ChevronLeft, ChevronRight, LayoutGrid, Plus, Minus, Maximize2, Minimize2 } from 'lucide-react';

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

  // Title & Pages State
  const [notebookTitle, setNotebookTitle] = useState(notebook.title);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isPageDrawerOpen, setIsPageDrawerOpen] = useState(false);

  // Drawing State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#1d4ed8');
  const [currentWidth, setCurrentWidth] = useState<number>(3);
  const [shapeMode, setShapeMode] = useState<ShapeMode>('none');
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [eraseHighlighterOnly, setEraseHighlighterOnly] = useState<boolean>(false);

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

  // Floating Bottom Page Navigation Auto-Hide on Inactivity
  const [isPageBarVisible, setIsPageBarVisible] = useState(true);
  const isHoveringPageBarRef = useRef(false);
  const hidePageBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetPageBarInactivityTimer = useCallback(() => {
    setIsPageBarVisible(true);
    if (hidePageBarTimeoutRef.current) {
      clearTimeout(hidePageBarTimeoutRef.current);
    }
    hidePageBarTimeoutRef.current = setTimeout(() => {
      if (!isHoveringPageBarRef.current) {
        setIsPageBarVisible(false);
      }
    }, 3000);
  }, []);

  // Show page bar on mouse movement, key activity, or touch, hide after 3s inactivity
  useEffect(() => {
    const handleActivity = () => {
      resetPageBarInactivityTimer();
    };

    window.addEventListener('pointermove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    resetPageBarInactivityTimer();

    return () => {
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (hidePageBarTimeoutRef.current) {
        clearTimeout(hidePageBarTimeoutRef.current);
      }
    };
  }, [resetPageBarInactivityTimer]);

  useEffect(() => {
    resetPageBarInactivityTimer();
  }, [currentPageIndex, resetPageBarInactivityTimer]);

  // Autosave status
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
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
    setSelectedImageId(null);

    Promise.all([
      db.getStrokesForPage(currentPage.id),
      db.getTextBoxesForPage(currentPage.id),
      db.getImagesForPage(currentPage.id),
    ]).then(([loadedStrokes, loadedTextBoxes, loadedImages]) => {
      if (isMounted) {
        setStrokes(loadedStrokes);
        setTextBoxes(loadedTextBoxes);
        setImages(loadedImages);
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
      } catch (err: any) {
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
      } catch (err: any) {
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

  // Stroke Batch Commit Handler (for Lasso and Moving Strokes / Shapes)
  const handleCommitStrokesUpdate = useCallback(
    (updatedStrokes: Stroke[], prevStrokes?: Stroke[]) => {
      if (!currentPage || updatedStrokes.length === 0) return;
      setStrokes((prev) => {
        const updatedMap = new Map(updatedStrokes.map((s) => [s.id, s]));
        const nextList = prev.map((s) => updatedMap.get(s.id) || s);
        if (prevStrokes && prevStrokes.length > 0) {
          historyRef.current.push({
            type: 'UPDATE_STROKES',
            prev: prevStrokes,
            current: updatedStrokes,
          });
        }
        triggerAutosaveStrokes(currentPage.id, nextList);
        return nextList;
      });
    },
    [currentPage, triggerAutosaveStrokes]
  );

  // Note Image Operations (Move, Resize, Duplicate, Delete)
  const handleUpdateImagePosition = (id: string, newX: number, newY: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, x: newX, y: newY } : img))
    );
  };

  const handleCommitImagePosition = (
    id: string,
    _oldX: number,
    _oldY: number,
    newX: number,
    newY: number
  ) => {
    if (!currentPage) return;
    setImages((prev) => {
      const updated = prev.map((img) => (img.id === id ? { ...img, x: newX, y: newY } : img));
      db.saveImagesForPage(currentPage.id, updated).catch((err) =>
        console.error('Failed to persist image position:', err)
      );
      return updated;
    });
  };

  const handleUpdateImageSize = (id: string, newW: number, newH: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, width: newW, height: newH } : img))
    );
  };

  const handleCommitImageSize = (
    id: string,
    _oldW: number,
    _oldH: number,
    newW: number,
    newH: number
  ) => {
    if (!currentPage) return;
    setImages((prev) => {
      const updated = prev.map((img) =>
        img.id === id ? { ...img, width: newW, height: newH } : img
      );
      db.saveImagesForPage(currentPage.id, updated).catch((err) =>
        console.error('Failed to persist image size:', err)
      );
      return updated;
    });
  };

  const handleDeleteImage = useCallback(
    (id: string) => {
      if (!currentPage) return;
      setImages((prev) => {
        const updated = prev.filter((img) => img.id !== id);
        db.deleteNoteImage(id).catch((err) =>
          console.error('Failed to delete image:', err)
        );
        return updated;
      });
      setSelectedImageId((prev) => (prev === id ? null : prev));
    },
    [currentPage]
  );

  const handleDuplicateImage = useCallback(
    (id: string) => {
      if (!currentPage) return;
      const target = images.find((img) => img.id === id);
      if (!target) return;
      const cloned: NoteImage = {
        ...target,
        id: crypto.randomUUID(),
        x: target.x + 20,
        y: target.y + 20,
        createdAt: Date.now(),
      };
      db.addNoteImage(cloned)
        .then(() => {
          setImages((prev) => [...prev, cloned]);
          setSelectedImageId(cloned.id);
        })
        .catch((err) => console.error('Failed to duplicate image:', err));
    },
    [currentPage, images]
  );

  // 6. Text Box Operations
  const handleCreateTextBox = (x: number, y: number) => {
    if (!currentPage) return;

    let currentList = textBoxes;
    if (editingTextBoxId) {
      const existing = currentList.find((t) => t.id === editingTextBoxId);
      if (existing) {
        const activeEl = document.querySelector('[contenteditable="true"]');
        const cleanContent = activeEl ? activeEl.innerHTML : existing.content;
        const isBlank = !cleanContent || cleanContent.trim() === '' || cleanContent === '<br>';
        const hasCustomBg = existing.backgroundColor && existing.backgroundColor !== 'transparent';
        if (isBlank && !hasCustomBg) {
          currentList = currentList.filter((t) => t.id !== editingTextBoxId);
          historyRef.current.push({ type: 'DELETE_TEXT_BOX', textBox: existing });
        } else if (existing.content !== cleanContent) {
          const updatedBox: TextBox = { ...existing, content: cleanContent, updatedAt: Date.now() };
          currentList = currentList.map((t) => (t.id === editingTextBoxId ? updatedBox : t));
          historyRef.current.push({ type: 'UPDATE_TEXT_BOX', prev: existing, current: updatedBox });
        }
      }
    }

    const newBox: TextBox = {
      id: crypto.randomUUID(),
      pageId: currentPage.id,
      x,
      y,
      width: currentTextBg && currentTextBg !== 'transparent' ? 180 : 48,
      height: currentTextBg && currentTextBg !== 'transparent' ? 70 : 26,
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

    const updated = [...currentList, newBox];
    setTextBoxes(updated);
    setSelectedTextBoxId(newBox.id);
    setEditingTextBoxId(newBox.id);
    historyRef.current.push({ type: 'ADD_TEXT_BOX', textBox: newBox });
    triggerAutosaveTextBoxes(currentPage.id, updated);
  };

  const handleClearPageStrokes = () => {
    if (!currentPage || strokes.length === 0) return;
    if (window.confirm('Clear all handwritten ink on this page? (You can Undo if needed)')) {
      const oldStrokes = [...strokes];
      setStrokes([]);
      historyRef.current.push({
        type: 'DELETE_STROKES',
        strokes: oldStrokes,
      });
      triggerAutosaveStrokes(currentPage.id, []);
    }
  };

  const handleUpdateTextBoxStyle = (id: string, updates: Partial<TextBox>) => {
    if (!currentPage) return;
    const existing = textBoxes.find((t) => t.id === id);
    if (!existing) return;
    const updatedBox: TextBox = { ...existing, ...updates, updatedAt: Date.now() };
    const updatedList = textBoxes.map((t) => (t.id === id ? updatedBox : t));
    setTextBoxes(updatedList);
    historyRef.current.push({
      type: 'UPDATE_TEXT_BOX',
      prev: existing,
      current: updatedBox,
    });
    triggerAutosaveTextBoxes(currentPage.id, updatedList);
  };

  const handleApplyTextPreset = (preset: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    bg?: string;
    color?: string;
  }) => {
    if (preset.fontFamily) setCurrentFontFamily(preset.fontFamily);
    if (preset.fontSize) setCurrentFontSize(preset.fontSize);
    if (preset.bold !== undefined) setIsBold(preset.bold);
    if (preset.bg) setCurrentTextBg(preset.bg);
    if (preset.color) setCurrentColor(preset.color);

    if (selectedTextBoxId) {
      handleUpdateTextBoxStyle(selectedTextBoxId, {
        ...(preset.fontFamily ? { fontFamily: preset.fontFamily } : {}),
        ...(preset.fontSize ? { fontSize: preset.fontSize } : {}),
        ...(preset.bold !== undefined ? { bold: preset.bold } : {}),
        ...(preset.bg ? {
          backgroundColor: preset.bg,
          borderColor: preset.bg === 'transparent' ? 'transparent' : '#cbd5e1',
          borderRadius: preset.bg === 'transparent' ? 6 : 10,
        } : {}),
        ...(preset.color ? { color: preset.color } : {}),
      });
    }
  };

  const handleEndEditingTextBox = (id: string, newContent: string) => {
    setEditingTextBoxId(null);
    if (!currentPage) return;

    const existing = textBoxes.find((t) => t.id === id);
    if (!existing) return;

    const cleanContent = (newContent === 'Click to edit...' || newContent === 'Click to edit' || newContent === 'Type notes here...') ? '' : newContent;
    const isBlank = !cleanContent || cleanContent.trim() === '' || cleanContent === '<br>';
    const hasCustomBg = existing.backgroundColor && existing.backgroundColor !== 'transparent';

    if (isBlank && !hasCustomBg) {
      handleDeleteTextBox(id);
      return;
    }

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
    setTextBoxes((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const prevBox: TextBox = { ...target, x: oldX, y: oldY };
      const currentBox: TextBox = { ...target, x: newX, y: newY, updatedAt: Date.now() };

      historyRef.current.push({
        type: 'UPDATE_TEXT_BOX',
        prev: prevBox,
        current: currentBox,
      });
      const updatedList = prev.map((t) => (t.id === id ? currentBox : t));
      triggerAutosaveTextBoxes(currentPage.id, updatedList);
      return updatedList;
    });
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
    setTextBoxes((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const prevBox: TextBox = { ...target, width: oldW, height: oldH };
      const currentBox: TextBox = { ...target, width: newW, height: newH, updatedAt: Date.now() };

      historyRef.current.push({
        type: 'UPDATE_TEXT_BOX',
        prev: prevBox,
        current: currentBox,
      });
      const updatedList = prev.map((t) => (t.id === id ? currentBox : t));
      triggerAutosaveTextBoxes(currentPage.id, updatedList);
      return updatedList;
    });
  };

  const handleDeleteTextBox = useCallback((id: string) => {
    if (!currentPage) return;
    setTextBoxes((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;

      const updated = prev.filter((t) => t.id !== id);
      historyRef.current.push({ type: 'DELETE_TEXT_BOX', textBox: target });
      triggerAutosaveTextBoxes(currentPage.id, updated);
      return updated;
    });
    setSelectedTextBoxId((prev) => (prev === id ? null : prev));
    setEditingTextBoxId((prev) => (prev === id ? null : prev));
  }, [currentPage, triggerAutosaveTextBoxes]);

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

  const handleInsertCode = () => {
    if (!selectedTextBoxId || !currentPage) return;
    const target = textBoxes.find((t) => t.id === selectedTextBoxId);
    if (!target) return;

    let codeToHighlight = target.content;
    if (!codeToHighlight || codeToHighlight === "Click to edit..." || codeToHighlight === "Click to edit") {
      codeToHighlight = "// Sample Code\nfunction calculateStats(items: number[]) {\n  const total = items.reduce((acc, curr) => acc + curr, 0);\n  return { total, count: items.length };\n}";
    }
    const detected = detectCodeSnippet(codeToHighlight);
    const highlightedCard = highlightCodeToHtml(detected.cleanedCode || codeToHighlight, detected.language || "typescript");

    const updatedBox: TextBox = {
      ...target,
      content: highlightedCard,
      width: Math.max(target.width, 480),
      height: Math.max(target.height, 160),
      updatedAt: Date.now(),
    };
    const updatedList = textBoxes.map((t) => (t.id === selectedTextBoxId ? updatedBox : t));
    setTextBoxes(updatedList);
    historyRef.current.push({ type: "UPDATE_TEXT_BOX", prev: target, current: updatedBox });
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

  const handleExportNotein = async () => {
    try {
      await exportNotebookAsNotein(notebook.id);
    } catch (err: any) {
      console.error("Export .notein failed:", err);
    }
  };

  const handleBackupToDrive = async () => {
    try {
      const allStrokes: Stroke[] = [];
      const allTextBoxes: TextBox[] = [];
      for (const p of pages) {
        const s = await db.getStrokesForPage(p.id);
        const tb = await db.getTextBoxesForPage(p.id);
        allStrokes.push(...s);
        allTextBoxes.push(...tb);
      }
      const uploaded = await uploadNotebookToGoogleDrive(notebook, pages, allStrokes, allTextBoxes);
      alert(`✓ Saved "${uploaded.name}" to your Google Drive!`);
    } catch (err: any) {
      console.error("Backup to Google Drive failed:", err);
      alert(`Google Drive backup failed: ${err?.message || err}`);
    }
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

  // Insert Image file handler (upload or paste)
  const handleInsertImageFile = useCallback((file: File) => {
    if (!currentPage) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(600, currentPage.width * 0.75);
        const scale = Math.min(1, maxW / (img.width || 400));
        const width = Math.round((img.width || 400) * scale);
        const height = Math.round((img.height || 300) * scale);
        const x = Math.max(20, Math.round((currentPage.width - width) / 2));
        const y = Math.max(20, Math.round((currentPage.height - height) / 3));

        const newImg: NoteImage = {
          id: crypto.randomUUID(),
          pageId: currentPage.id,
          src: dataUrl,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: 1,
          createdAt: Date.now(),
        };

        db.addNoteImage(newImg).then(() => {
          setImages((prev) => [...prev, newImg]);
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [currentPage]);

  // Global Clipboard Image Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleInsertImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleInsertImageFile]);

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
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable
        );
        if (!isTyping && !editingTextBoxId) {
          e.preventDefault();
          handleDeleteTextBox(selectedTextBoxId);
        }
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
  }, [handleUndo, handleRedo, selectedTextBoxId, editingTextBoxId, handleDeleteTextBox]);

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

  // Keyboard page navigation (ArrowLeft / ArrowRight / PageUp / PageDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        editingTextBoxId ||
        ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPageIndex < pages.length - 1) {
          e.preventDefault();
          setCurrentPageIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPageIndex > 0) {
          e.preventDefault();
          setCurrentPageIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTextBoxId, currentPageIndex, pages.length]);

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
          notebookTitle={notebookTitle}
          onBack={onBack}
          onRenameTitle={async (newTitle) => {
            if (!newTitle.trim()) return;
            await db.updateNotebookTitle(notebook.id, newTitle.trim());
            setNotebookTitle(newTitle.trim());
            notebook.title = newTitle.trim();
          }}
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
          onInsertCode={handleInsertCode}
          onDuplicateTextBox={handleDuplicateTextBox}
          selectedTextBoxId={selectedTextBoxId}
          onDeleteTextBox={selectedTextBoxId ? () => handleDeleteTextBox(selectedTextBoxId) : undefined}
          onExportNotein={handleExportNotein}
          onBackupToDrive={handleBackupToDrive}
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
          isReadOnly={isReadOnly}
          onToggleReadOnly={() => setIsReadOnly((prev) => !prev)}
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
          shapeMode={shapeMode}
          onChangeShapeMode={setShapeMode}
          isRulerActive={isRulerActive}
          onToggleRuler={() => setIsRulerActive((prev) => !prev)}
          eraseHighlighterOnly={eraseHighlighterOnly}
          onToggleEraseHighlighterOnly={() => setEraseHighlighterOnly((prev) => !prev)}
          onClearPage={handleClearPageStrokes}
          onApplyTextPreset={handleApplyTextPreset}
          onInsertImage={handleInsertImageFile}
        />
      )}

      {/* Main Responsive Canvas & Text Surface */}
      {currentPage ? (
        <PaperCanvas
          page={currentPage}
          strokes={strokes}
          textBoxes={textBoxes}
          images={images}
          activeTool={activeTool}
          currentColor={currentColor}
          currentWidth={currentWidth}
          transform={transform}
          onTransformChange={setTransform}
          onAddStroke={handleAddStroke}
          onStrokesLiveUpdate={handleStrokesLiveUpdate}
          onDeleteStrokesCommit={handleDeleteStrokesCommit}
          onCommitStrokesUpdate={handleCommitStrokesUpdate}
          selectedImageId={selectedImageId}
          onSelectImage={setSelectedImageId}
          onUpdateImagePosition={handleUpdateImagePosition}
          onCommitImagePosition={handleCommitImagePosition}
          onUpdateImageSize={handleUpdateImageSize}
          onCommitImageSize={handleCommitImageSize}
          onDeleteImage={handleDeleteImage}
          onDuplicateImage={handleDuplicateImage}
          onCreateTextBox={handleCreateTextBox}
          selectedTextBoxId={selectedTextBoxId}
          editingTextBoxId={editingTextBoxId}
          onSelectTextBox={(id) => {
            setSelectedTextBoxId(id);
            if (!id) {
              setEditingTextBoxId(null);
            }
          }}
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
          shapeMode={shapeMode}
          isRulerActive={isRulerActive}
          onCloseRuler={() => setIsRulerActive(false)}
          eraseHighlighterOnly={eraseHighlighterOnly}
          onSelectTool={setActiveTool}
          onUpdateTextBoxStyle={handleUpdateTextBoxStyle}
          isReadOnly={isReadOnly}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <FeatherLoader message="Loading Page..." size={72} />
        </div>
      )}

      {/* Floating Bottom Page Navigation Controls */}
      {pages.length > 0 && (
        <div
          onMouseEnter={() => {
            isHoveringPageBarRef.current = true;
            setIsPageBarVisible(true);
            if (hidePageBarTimeoutRef.current) {
              clearTimeout(hidePageBarTimeoutRef.current);
            }
          }}
          onMouseLeave={() => {
            isHoveringPageBarRef.current = false;
            resetPageBarInactivityTimer();
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: isPageBarVisible
              ? 'translateX(-50%) translateY(0)'
              : 'translateX(-50%) translateY(28px)',
            opacity: isPageBarVisible ? 1 : 0,
            pointerEvents: isPageBarVisible ? 'auto' : 'none',
            transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '24px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.16)',
            zIndex: 45,
            backdropFilter: 'blur(8px)',
            userSelect: 'none',
          }}
        >
          {/* Previous Page Button */}
          <button
            onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentPageIndex <= 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: currentPageIndex <= 0 ? 'transparent' : 'var(--bg-tertiary)',
              color: currentPageIndex <= 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: currentPageIndex <= 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Go to Previous Page"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          {/* Current Page / Overview Trigger */}
          <button
            onClick={() => setIsPageDrawerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Open Page Overview"
          >
            <LayoutGrid size={13} color="#3f52ff" />
            <span>
              Page {currentPageIndex + 1} of {pages.length}
            </span>
          </button>

          {/* Next Page Button */}
          <button
            onClick={() => {
              if (currentPageIndex < pages.length - 1) {
                setCurrentPageIndex((prev) => prev + 1);
              } else {
                handleAddPage();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: '#3f52ff',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(63, 82, 255, 0.3)',
              transition: 'all 0.15s ease',
            }}
            title={currentPageIndex < pages.length - 1 ? 'Go to Next Page' : 'Add and Go to Next Page'}
          >
            <span>{currentPageIndex < pages.length - 1 ? 'Next' : 'Next (+ Page)'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Floating Bottom-Right Zoom & Fit Controls (Shifted from Top Header with Inactivity Auto-Hide) */}
      <div
        id="bottom-right-zoom-controls"
        onMouseEnter={() => {
          isHoveringPageBarRef.current = true;
          setIsPageBarVisible(true);
          if (hidePageBarTimeoutRef.current) {
            clearTimeout(hidePageBarTimeoutRef.current);
          }
        }}
        onMouseLeave={() => {
          isHoveringPageBarRef.current = false;
          resetPageBarInactivityTimer();
        }}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '24px',
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px 6px',
          borderRadius: '24px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.16)',
          backdropFilter: 'blur(8px)',
          userSelect: 'none',
          transform: isPageBarVisible ? 'translateY(0)' : 'translateY(28px)',
          opacity: isPageBarVisible ? 1 : 0,
          pointerEvents: isPageBarVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          title="Zoom Out (-)"
        >
          <Minus size={14} />
        </button>

        {/* Zoom Percentage / Reset to 100% */}
        <button
          onClick={handleResetZoom}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 6px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: '44px',
          }}
          title="Click to Reset Zoom to 100%"
        >
          {Math.round(transform.zoom * 100)}%
        </button>

        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          title="Zoom In (+)"
        >
          <Plus size={14} />
        </button>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--border-subtle)',
            margin: '0 4px',
          }}
        />

        {/* Fit to Screen / Overview Toggle */}
        <button
          onClick={() => handleFitPage()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '16px',
            border: 'none',
            backgroundColor: isCoverMode ? 'rgba(63, 82, 255, 0.12)' : 'var(--bg-tertiary)',
            color: isCoverMode ? '#3f52ff' : 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title={isCoverMode ? 'Fit Page Overview' : 'Fit to Screen (Cover)'}
        >
          {isCoverMode ? <Minimize2 size={13} color="#3f52ff" /> : <Maximize2 size={13} color="#3f52ff" />}
          <span>{isCoverMode ? 'Overview' : 'Fit'}</span>
        </button>
      </div>

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
        currentStrokes={strokes}
        currentTextBoxes={textBoxes}
        currentImages={images}
      />
    </div>
  );
};
