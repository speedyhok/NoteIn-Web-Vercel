// NoteIn Android Authentic Floating & Movable Toolbar Component
// Supports horizontal & vertical orientation, smooth dragging anywhere on screen, and full tool interactivity

import React, { useState, useRef, useEffect } from 'react';
import type { ToolType, PaperTemplate, PageOrientation } from '../../types';
import type { ShapeMode } from './PaperCanvas';
import {
  NoteinArrowBack,
  NoteinUndo,
  NoteinRedo,
  NoteinFountainPenTip,
  NoteinBallpointPenTip,
  NoteinHighlighterTip,
  NoteinEraserStroke,
  NoteinHand,
  NoteinLasso,
  NoteinShapes,
  NoteinTextBox,
  NoteinRuler,
  NoteinColorPicker,
  NoteinMore,
  NoteinShare,
} from '../icons/NoteinIcons';
import {
  Sun,
  Moon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Code as CodeIcon,
  Copy,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  HardDrive,
  Download,
  LayoutGrid,
  GripVertical,
  GripHorizontal,
  Columns,
  Rows,
  Minus,
  Square,
  Circle,
  Triangle,
  ArrowRight,
  Sparkles,
  Maximize2,
  Minimize2,
  Palette,
  Trash2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Image as ImageIcon,
  BookOpen,
  Eye,
} from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { StrokeWidthPicker } from './StrokeWidthPicker';
import { TemplateSelector } from './TemplateSelector';

interface ToolbarProps {
  notebookTitle: string;
  onBack: () => void;
  onRenameTitle?: (newTitle: string) => void;
  activeTool: ToolType;
  onChangeTool: (tool: ToolType) => void;
  currentColor: string;
  onChangeColor: (color: string) => void;
  currentWidth: number;
  onChangeWidth: (width: number) => void;
  // Advanced Text formatting
  currentFontFamily: string;
  onChangeFontFamily: (font: string) => void;
  currentFontSize: number;
  onChangeFontSize: (size: number) => void;
  isBold: boolean;
  onToggleBold: () => void;
  isItalic: boolean;
  onToggleItalic: () => void;
  isUnderline?: boolean;
  onToggleUnderline?: () => void;
  isStrikethrough?: boolean;
  onToggleStrikethrough?: () => void;
  alignment: 'left' | 'center' | 'right' | 'justify';
  onChangeAlignment: (align: 'left' | 'center' | 'right' | 'justify') => void;
  currentTextBg?: string;
  onChangeTextBg?: (bg: string) => void;
  onInsertBullet?: () => void;
  onInsertNumbered?: () => void;
  onInsertCode?: () => void;
  onDuplicateTextBox?: () => void;
  selectedTextBoxId?: string | null;
  onDeleteTextBox?: () => void;
  onExportNotein?: () => void;
  onBackupToDrive?: () => void;
  // Orientation
  pageOrientation: PageOrientation;
  onToggleOrientation: () => void;
  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Zoom
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitPage: () => void;
  isCoverMode?: boolean;
  // Pages
  currentPageIndex: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onTogglePageDrawer: () => void;
  currentTemplate: PaperTemplate;
  onChangeTemplate: (template: PaperTemplate) => void;
  isSaving: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isReadOnly?: boolean;
  onToggleReadOnly?: () => void;
  // Shape & Ruler
  shapeMode?: ShapeMode;
  onChangeShapeMode?: (mode: ShapeMode) => void;
  isRulerActive?: boolean;
  onToggleRuler?: () => void;
  eraseHighlighterOnly?: boolean;
  onToggleEraseHighlighterOnly?: () => void;
  onClearPage?: () => void;
  onInsertImage?: (file: File) => void;
  onApplyTextPreset?: (preset: {
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    bg?: string;
    color?: string;
  }) => void;
}

const FONT_FAMILIES = [
  { label: 'Inter (Clean Sans)', value: 'Inter, sans-serif' },
  { label: 'Roboto (Modern)', value: 'Roboto, sans-serif' },
  { label: 'Caveat (Handwritten)', value: 'Caveat, cursive' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Courier (Code Mono)', value: '"Courier New", monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];



// NoteIn Quick Preset Colors
const QUICK_NOTEIN_COLORS = ['#1c1917', '#1d4ed8', '#dc2626', '#16a34a', '#d97706'];

export const Toolbar: React.FC<ToolbarProps> = ({
  notebookTitle,
  onBack,
  onRenameTitle,
  activeTool,
  onChangeTool,
  currentColor,
  onChangeColor,
  currentWidth,
  onChangeWidth,
  currentFontFamily,
  onChangeFontFamily,
  currentFontSize,
  onChangeFontSize,
  isBold,
  onToggleBold,
  isItalic,
  onToggleItalic,
  isUnderline = false,
  onToggleUnderline,
  isStrikethrough = false,
  onToggleStrikethrough,
  alignment,
  onChangeAlignment,
  currentTextBg = 'transparent',
  onChangeTextBg,
  onInsertBullet,
  onInsertCode,
  onDuplicateTextBox,
  selectedTextBoxId,
  onDeleteTextBox,
  onExportNotein,
  onBackupToDrive,
  pageOrientation,
  onToggleOrientation,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom: _zoom,
  onZoomIn: _onZoomIn,
  onZoomOut: _onZoomOut,
  onResetZoom: _onResetZoom,
  onFitPage: _onFitPage,
  isCoverMode: _isCoverMode = false,
  currentPageIndex,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddPage,
  onTogglePageDrawer,
  currentTemplate,
  onChangeTemplate,
  isSaving,
  isDarkMode,
  onToggleTheme,
  isReadOnly = false,
  onToggleReadOnly,
  shapeMode = 'none',
  onChangeShapeMode,
  isRulerActive = false,
  onToggleRuler,
  eraseHighlighterOnly = false,
  onToggleEraseHighlighterOnly,
  onClearPage,
  onInsertImage,
  onApplyTextPreset,
}) => {
  // Popovers
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(notebookTitle);

  useEffect(() => {
    setTempTitle(notebookTitle);
  }, [notebookTitle]);

  const handleFinishTitleRename = () => {
    setIsEditingTitle(false);
    const trimmed = tempTitle.trim();
    if (trimmed && trimmed !== notebookTitle && onRenameTitle) {
      onRenameTitle(trimmed);
    } else {
      setTempTitle(notebookTitle);
    }
  };

  const [colorOpen, setColorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [widthOpen, setWidthOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  const [textPresetsOpen, setTextPresetsOpen] = useState(false);
  const closeAllPopovers = () => {
    setColorOpen(false);
    setExportOpen(false);
    setWidthOpen(false);
    setTemplateOpen(false);
    setShapeMenuOpen(false);
    setEraserMenuOpen(false);
    setTextPresetsOpen(false);
  };

  // Pen Slot Selection (1: Fountain Pen, 2: Ballpoint Pen, 3: Highlighter)
  const [activePenSlot, setActivePenSlot] = useState<1 | 2 | 3>(() => (activeTool === 'highlighter' ? 3 : 1));

  // Floating Toolbar Movement & Orientation State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [toolbarOrientation, setToolbarOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Default coordinate calculation
  const getEffectivePos = () => {
    if (toolbarPos) return toolbarPos;
    if (toolbarOrientation === 'horizontal') {
      return {
        x: Math.max(16, (window.innerWidth - 720) / 2),
        y: 64,
      };
    } else {
      return {
        x: 24,
        y: 72,
      };
    }
  };

  const currentPos = getEffectivePos();

  // Dragging event handler
  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: currentPos.x,
      initialY: currentPos.y,
    };
    setIsDragging(true);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.clientX;
      const dy = ev.clientY - dragStartRef.current.clientY;

      const approxWidth = toolbarOrientation === 'horizontal' ? 700 : 64;
      const approxHeight = toolbarOrientation === 'horizontal' ? 52 : 460;

      const newX = Math.max(8, Math.min(window.innerWidth - approxWidth - 8, dragStartRef.current.initialX + dx));
      const newY = Math.max(54, Math.min(window.innerHeight - approxHeight - 8, dragStartRef.current.initialY + dy));

      setToolbarPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Toggle Orientation between Horizontal and Vertical
  const handleToggleOrientation = () => {
    const next = toolbarOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    setToolbarOrientation(next);

    if (next === 'vertical') {
      const isRightHalf = currentPos.x > window.innerWidth / 2;
      const targetX = isRightHalf ? window.innerWidth - 74 : 18;
      const targetY = Math.max(64, Math.min(window.innerHeight - 420, currentPos.y));
      setToolbarPos({ x: targetX, y: targetY });
    } else {
      const targetX = Math.max(16, (window.innerWidth - 720) / 2);
      const targetY = 64;
      setToolbarPos({ x: targetX, y: targetY });
    }
  };

  const handleSelectSlot = (slot: 1 | 2 | 3) => {
    if (activePenSlot === slot && ((slot === 3 && activeTool === 'highlighter') || (slot !== 3 && activeTool === 'pen'))) {
      // Second click toggles width picker for convenience
      const next = !widthOpen;
            closeAllPopovers();
            setWidthOpen(next);
      return;
    }

    setActivePenSlot(slot);
    if (onChangeShapeMode) onChangeShapeMode('none');

    if (slot === 1) {
      onChangeTool('pen');
      if (currentWidth > 6 || currentWidth < 2) onChangeWidth(3.5);
    } else if (slot === 2) {
      onChangeTool('pen');
      if (currentWidth !== 2) onChangeWidth(2.0);
    } else if (slot === 3) {
      onChangeTool('highlighter');
      if (currentWidth < 10) onChangeWidth(18.0);
    }
  };

  const isVertical = toolbarOrientation === 'vertical';

  return (
    <>
      {/* =========================================================================
          TOP NAVIGATION BAR (NoteIn Android Top Bar)
          ========================================================================= */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 40,
        }}
      >
        {/* Left: Back button & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            id="back-to-library-btn"
            onClick={onBack}
            style={{
              padding: '8px',
              borderRadius: '9999px',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Back to Library"
          >
            <NoteinArrowBack size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditingTitle ? (
              <input
                id="editor-title-rename-input"
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleFinishTitleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishTitleRename();
                  if (e.key === 'Escape') {
                    setTempTitle(notebookTitle);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                onFocus={(e) => e.target.select()}
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid #007AFF',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  outline: 'none',
                  minWidth: '150px',
                }}
              />
            ) : (
              <div
                id="editor-title-container"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename document"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {notebookTitle}
                </span>
                <Edit2 size={12} color="var(--text-muted)" style={{ opacity: 0.6 }} />
              </div>
            )}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: isSaving ? 'rgba(234, 179, 8, 0.15)' : 'rgba(22, 163, 74, 0.12)',
                color: isSaving ? '#ca8a04' : '#16a34a',
              }}
            >
              {isSaving ? 'Saving...' : 'Saved'}
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Page Navigation & Thumbnails Group */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            {/* Previous Page Button */}
            <button
              onClick={onPrevPage}
              disabled={currentPageIndex <= 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 7px',
                background: 'transparent',
                border: 'none',
                color: currentPageIndex <= 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: currentPageIndex <= 0 ? 'not-allowed' : 'pointer',
              }}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Current Page / Overview */}
            <button
              onClick={onTogglePageDrawer}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                background: 'transparent',
                border: 'none',
                borderLeft: '1px solid var(--border-subtle)',
                borderRight: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="View Page Overview / Thumbnails"
            >
              <LayoutGrid size={13} />
              <span>
                {currentPageIndex + 1} / {totalPages}
              </span>
            </button>

            {/* Next Page Button */}
            <button
              onClick={onNextPage}
              disabled={currentPageIndex >= totalPages - 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 7px',
                background: 'transparent',
                border: 'none',
                color: currentPageIndex >= totalPages - 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: currentPageIndex >= totalPages - 1 ? 'not-allowed' : 'pointer',
              }}
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Add Page Button */}
          <button
            onClick={onAddPage}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--accent-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Add Page"
          >
            <Plus size={14} />
            <span>Page</span>
          </button>

          {/* Orientation Toggle */}
          <button
            onClick={onToggleOrientation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title={`Page Orientation: ${pageOrientation}`}
          >
            {pageOrientation === 'landscape' ? (
              <>
                <RectangleHorizontal size={14} color="#3f52ff" />
                <span className="hide-on-mobile">Landscape</span>
              </>
            ) : (
              <>
                <RectangleVertical size={14} color="#3f52ff" />
                <span className="hide-on-mobile">Portrait</span>
              </>
            )}
          </button>

          {/* Read Only Mode Toggle (In Top Header where Zoom button was) */}
          {onToggleReadOnly && (
            <button
              id="read-only-mode-toggle-btn"
              onClick={onToggleReadOnly}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                border: isReadOnly ? '1.5px solid #3f52ff' : '1px solid var(--border-subtle)',
                backgroundColor: isReadOnly ? 'rgba(63, 82, 255, 0.15)' : 'var(--bg-tertiary)',
                color: isReadOnly ? '#3f52ff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isReadOnly ? '0 0 0 1px rgba(63, 82, 255, 0.25)' : 'none',
              }}
              title={isReadOnly ? 'Read Only Mode Active: Click to show pen bar and edit' : 'Read Only Mode: Hides pen bar for clean reading'}
            >
              {isReadOnly ? <BookOpen size={14} color="#3f52ff" /> : <Eye size={14} />}
              <span>{isReadOnly ? 'Reading' : 'Read Only'}</span>
            </button>
          )}

          {/* Paper Template Selector */}
          <button
            onClick={() => setTemplateOpen(true)}
            style={{
              padding: '7px',
              borderRadius: '9999px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Paper Templates"
          >
            <LayoutGrid size={16} />
          </button>

          {/* Share / Export & Drive */}
          {(onExportNotein || onBackupToDrive) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setExportOpen(!exportOpen)}
                style={{
                  padding: '7px',
                  borderRadius: '9999px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="Share & Cloud Backup"
              >
                <NoteinShare size={18} />
              </button>

              {exportOpen && (
                <div
                  className="animate-slide-down"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    width: '210px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 50,
                  }}
                >
                  {onBackupToDrive && (
                    <button
                      onClick={() => {
                        setExportOpen(false);
                        onBackupToDrive();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <HardDrive size={14} color="#3f52ff" />
                      Save to Google Drive
                    </button>
                  )}
                  {onExportNotein && (
                    <button
                      onClick={() => {
                        setExportOpen(false);
                        onExportNotein();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Download size={14} color="#16a34a" />
                      Export .notein Package
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* More Options */}
          <button
            onClick={() => setTemplateOpen(true)}
            style={{
              padding: '7px',
              borderRadius: '9999px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Notebook Settings"
          >
            <NoteinMore size={18} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            style={{
              padding: '7px',
              borderRadius: '9999px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            title={isDarkMode ? 'Light Theme' : 'Dark Theme'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* =========================================================================
          MOVABLE & ORIENTABLE NOTEIN ANDROID FLOATING TOOLBAR
          Can be freely dragged anywhere on screen and switched between horizontal/vertical
          ========================================================================= */}
      {!isReadOnly && (
        isCollapsed ? (
        /* Collapsed Floating Tool Badge (NoteIn Android Compact Penbox) */
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            left: `${currentPos.x}px`,
            top: `${currentPos.y}px`,
            zIndex: 48,
            borderRadius: '9999px',
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.06)',
            backgroundColor: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid var(--border-subtle)',
            userSelect: 'none',
            transition: isDragging ? 'none' : 'all 0.2s ease',
          }}
        >
          {/* Drag Handle Grip */}
          <div
            onPointerDown={handleDragPointerDown}
            style={{
              padding: '2px',
              cursor: isDragging ? 'grabbing' : 'grab',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Drag compact pen bar anywhere on screen"
          >
            <GripVertical size={14} />
          </div>

          {/* Active Tool Preview Pill */}
          <div
            onClick={() => setIsCollapsed(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
            title="Click to expand pen bar"
          >
            {activeTool === 'pen' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: currentColor,
                    border: '1.5px solid rgba(0,0,0,0.15)',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pen {currentWidth}px
                </span>
              </div>
            )}
            {activeTool === 'highlighter' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '12px',
                    height: '8px',
                    borderRadius: '2px',
                    backgroundColor: currentColor,
                    opacity: 0.75,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Highlighter {currentWidth}px
                </span>
              </div>
            )}
            {activeTool === 'eraser' && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Eraser
              </span>
            )}
            {activeTool === 'pan' && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Hand
              </span>
            )}
            {activeTool === 'text' && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Text
              </span>
            )}
            {activeTool === 'lasso' && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Lasso
              </span>
            )}
          </div>

          {/* Expand Toolbar Button */}
          <button
            onClick={() => setIsCollapsed(false)}
            style={{
              padding: '4px 6px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(63, 82, 255, 0.12)',
              border: 'none',
              color: '#3f52ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Expand Pen Bar"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      ) : (
        /* Full Movable Floating Toolbar */
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
          left: `${currentPos.x}px`,
          top: `${currentPos.y}px`,
          zIndex: 48,
          borderRadius: isVertical ? '24px' : '9999px',
          padding: isVertical ? '10px 6px' : '6px 12px',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          gap: isVertical ? '8px' : '10px',
          boxShadow: '0 10px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.06)',
          backgroundColor: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid var(--border-subtle)',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        }}
      >
        {/* DRAG HANDLE & ORIENTATION TOGGLE */}
        <div
          style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {/* Drag Handle Grip */}
          <div
            onPointerDown={handleDragPointerDown}
            style={{
              padding: '4px',
              cursor: isDragging ? 'grabbing' : 'grab',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            title="Drag toolbar anywhere on screen"
          >
            {isVertical ? <GripHorizontal size={16} /> : <GripVertical size={16} />}
          </div>

          {/* Toggle Horizontal / Vertical Orientation Button */}
          <button
            onClick={handleToggleOrientation}
            style={{
              padding: '5px',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isVertical ? 'Switch to Horizontal Bar' : 'Switch to Vertical Bar'}
          >
            {isVertical ? <Rows size={16} color="#3f52ff" /> : <Columns size={16} color="#3f52ff" />}
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: isVertical ? '32px' : '1px',
            height: isVertical ? '1px' : '22px',
            backgroundColor: 'var(--border-subtle)',
          }}
        />

        {/* GROUP 1: Undo & Redo */}
        <div
          style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <button
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              padding: '6px',
              borderRadius: '9999px',
              color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: canUndo ? 'pointer' : 'default',
              opacity: canUndo ? 1 : 0.35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Undo"
          >
            <NoteinUndo size={19} />
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              padding: '6px',
              borderRadius: '9999px',
              color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: canRedo ? 'pointer' : 'default',
              opacity: canRedo ? 1 : 0.35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Redo"
          >
            <NoteinRedo size={19} />
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: isVertical ? '32px' : '1px',
            height: isVertical ? '1px' : '22px',
            backgroundColor: 'var(--border-subtle)',
          }}
        />

        {/* GROUP 2: 3 Signature Pen Slots */}
        <div
          style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            gap: isVertical ? '6px' : '8px',
          }}
        >
          {/* Slot 1: Fountain Pen */}
          <button
            onClick={() => handleSelectSlot(1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            title="Fountain Pen (Calligraphy nib with pressure sensitivity - click again for width)"
          >
            <NoteinFountainPenTip
              size={26}
              inkColor={currentColor}
              selected={activeTool === 'pen' && activePenSlot === 1 && shapeMode === 'none'}
            />
            {activeTool === 'pen' && activePenSlot === 1 && shapeMode === 'none' && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#3f52ff',
                  position: 'absolute',
                  bottom: '-3px',
                }}
              />
            )}
          </button>

          {/* Slot 2: Ballpoint Pen */}
          <button
            onClick={() => handleSelectSlot(2)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            title="Ballpoint Pen (Precision fine point - click again for width)"
          >
            <NoteinBallpointPenTip
              size={26}
              inkColor={currentColor}
              selected={activeTool === 'pen' && activePenSlot === 2 && shapeMode === 'none'}
            />
            {activeTool === 'pen' && activePenSlot === 2 && shapeMode === 'none' && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#3f52ff',
                  position: 'absolute',
                  bottom: '-3px',
                }}
              />
            )}
          </button>

          {/* Slot 3: Chisel-Tip Highlighter */}
          <button
            onClick={() => handleSelectSlot(3)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            title="Highlighter (Angled translucent chisel tip - click again for width)"
          >
            <NoteinHighlighterTip
              size={26}
              inkColor={activeTool === 'highlighter' ? currentColor : '#facc15'}
              selected={activeTool === 'highlighter'}
            />
            {activeTool === 'highlighter' && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#3f52ff',
                  position: 'absolute',
                  bottom: '-3px',
                }}
              />
            )}
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: isVertical ? '32px' : '1px',
            height: isVertical ? '1px' : '22px',
            backgroundColor: 'var(--border-subtle)',
          }}
        />

        {/* GROUP 3: Main Tools (Eraser, Hand / Move Screen, Lasso, Shapes, Text Box, Ruler, Fit to Screen) */}
        <div
          style={{
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {/* Eraser with Dropdown Popover */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (activeTool === 'eraser') {
                  const next = !eraserMenuOpen;
                  closeAllPopovers();
                  setEraserMenuOpen(next);
                } else {
                  closeAllPopovers();
                  onChangeTool('eraser');
                  if (onChangeShapeMode) onChangeShapeMode('none');
                }
              }}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                color: activeTool === 'eraser' ? '#3f52ff' : 'var(--text-secondary)',
                backgroundColor: activeTool === 'eraser' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              title="Eraser (Click again for options: Erase Highlighter Only, Clear Page)"
            >
              <NoteinEraserStroke size={19} />
              {eraseHighlighterOnly && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#eab308',
                  }}
                  title="Erase Highlighter Only active"
                />
              )}
            </button>

            {/* Eraser Options Popover */}
            {eraserMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                  onClick={() => setEraserMenuOpen(false)}
                />
                <div
                  className="animate-scale-up"
                  style={{
                    position: 'absolute',
                    top: isVertical ? '0' : '100%',
                    left: isVertical ? '100%' : '50%',
                    transform: isVertical ? 'none' : 'translateX(-50%)',
                    marginLeft: isVertical ? '8px' : 0,
                    marginTop: isVertical ? 0 : '8px',
                    width: '215px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                    padding: '10px',
                    zIndex: 70,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Eraser Options
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NoteIn APK</span>
                  </div>

                  {/* Erase Highlighter Only Toggle */}
                  {onToggleEraseHighlighterOnly && (
                    <button
                      type="button"
                      onClick={() => onToggleEraseHighlighterOnly()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: eraseHighlighterOnly ? '1.5px solid #eab308' : '1px solid var(--border-subtle)',
                        backgroundColor: eraseHighlighterOnly ? 'rgba(234, 179, 8, 0.12)' : 'var(--bg-tertiary)',
                        color: eraseHighlighterOnly ? '#b45309' : 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                        <span>Erase Highlighter Only</span>
                      </div>
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: eraseHighlighterOnly ? '#eab308' : 'transparent',
                          border: eraseHighlighterOnly ? 'none' : '1.5px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        {eraseHighlighterOnly && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  )}

                  {/* Eraser Radius size chips */}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                      Radius Size
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                      {[
                        { label: 'Small', size: 10 },
                        { label: 'Medium', size: 22 },
                        { label: 'Large', size: 45 },
                      ].map((r) => {
                        const isSel = Math.abs(currentWidth - r.size) < 4;
                        return (
                          <button
                            key={r.label}
                            type="button"
                            onClick={() => onChangeWidth(r.size)}
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              border: isSel ? '1px solid #3f52ff' : '1px solid var(--border-subtle)',
                              backgroundColor: isSel ? 'rgba(63, 82, 255, 0.12)' : 'transparent',
                              color: isSel ? '#3f52ff' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clear All Page Strokes */}
                  {onClearPage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEraserMenuOpen(false);
                        onClearPage();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        color: '#ef4444',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '2px',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Clear Page Ink</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Screen Moving Tool (Authentic NoteIn Hand) */}
          <button
            onClick={() => {
              onChangeTool('pan');
              if (onChangeShapeMode) onChangeShapeMode('none');
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              color: activeTool === 'pan' ? '#3f52ff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'pan' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Hand / Move Screen (Drag anywhere on page to pan and scroll freely)"
          >
            <NoteinHand size={19} />
          </button>

          {/* Lasso Selection Tool */}
          <button
            onClick={() => {
              onChangeTool('lasso');
              if (onChangeShapeMode) onChangeShapeMode('none');
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              color: activeTool === 'lasso' ? '#3f52ff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'lasso' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Lasso Selection (Draw around strokes to select and move)"
          >
            <NoteinLasso size={19} />
          </button>

          {/* Shapes Tool Button with Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShapeMenuOpen(!shapeMenuOpen)}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                color: shapeMode !== 'none' ? '#3f52ff' : 'var(--text-secondary)',
                backgroundColor: shapeMode !== 'none' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={shapeMode !== "none" ? `Shapes: ${shapeMode.toUpperCase()} active (Click to change or turn off)` : "Geometric Shapes (Rectangle, Circle, Line, Triangle, Arrow)"}
            >
              <NoteinShapes size={19} />
            </button>

            {/* Shapes Popover Menu */}
            {shapeMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                  onClick={() => setShapeMenuOpen(false)}
                />
                <div
                  className="animate-scale-up"
                  style={{
                    position: 'absolute',
                    top: isVertical ? '0' : '100%',
                    left: isVertical ? '100%' : '50%',
                    transform: isVertical ? 'none' : 'translateX(-50%)',
                    marginLeft: isVertical ? '8px' : 0,
                    marginTop: isVertical ? 0 : '8px',
                    width: '180px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                    padding: '6px',
                    zIndex: 70,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                    Geometric Shapes
                  </div>
                  {[
                    { id: 'rect' as ShapeMode, label: 'Rectangle / Box', icon: Square },
                    { id: 'circle' as ShapeMode, label: 'Circle / Oval', icon: Circle },
                    { id: 'line' as ShapeMode, label: 'Straight Line', icon: Minus },
                    { id: 'triangle' as ShapeMode, label: 'Triangle', icon: Triangle },
                    { id: 'arrow' as ShapeMode, label: 'Arrow', icon: ArrowRight },
                    { id: 'auto' as ShapeMode, label: 'Auto Shape Snap', icon: Sparkles },
                    { id: 'none' as ShapeMode, label: 'Freehand Pen (Off)', icon: null },
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = shapeMode === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (onChangeShapeMode) onChangeShapeMode(s.id);
                          if (s.id !== 'none') onChangeTool('pen');
                          setShapeMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: isSelected ? 'rgba(63, 82, 255, 0.1)' : 'transparent',
                          color: isSelected ? '#3f52ff' : 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {Icon && <Icon size={14} color={isSelected ? '#3f52ff' : 'currentColor'} />}
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Text Box Tool with Quick Presets Dropdown */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => {
                  onChangeTool('text');
                  if (onChangeShapeMode) onChangeShapeMode('none');
                }}
                style={{
                  padding: '6px 5px 6px 7px',
                  borderRadius: textPresetsOpen ? '8px 0 0 8px' : '8px',
                  color: activeTool === 'text' ? '#3f52ff' : 'var(--text-secondary)',
                  backgroundColor: activeTool === 'text' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Text Mode (Click to type notes or sticky notes)"
              >
                <NoteinTextBox size={19} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !textPresetsOpen;
                  closeAllPopovers();
                  setTextPresetsOpen(next);
                }}
                style={{
                  padding: '6px 3px',
                  borderRadius: textPresetsOpen ? '0 8px 8px 0' : '8px',
                  color: activeTool === 'text' ? '#3f52ff' : 'var(--text-muted)',
                  backgroundColor: activeTool === 'text' ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Text Presets & Sticky Notes Menu"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {/* Text Presets Menu */}
            {textPresetsOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                  onClick={() => setTextPresetsOpen(false)}
                />
                <div
                  className="animate-scale-up"
                  style={{
                    position: 'absolute',
                    top: isVertical ? '0' : '100%',
                    left: isVertical ? '100%' : '50%',
                    transform: isVertical ? 'none' : 'translateX(-50%)',
                    marginLeft: isVertical ? '8px' : 0,
                    marginTop: isVertical ? 0 : '8px',
                    width: '215px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                    padding: '6px',
                    zIndex: 70,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px' }}>
                    NoteIn Text & Note Cards
                  </div>
                  {[
                    { id: 'plain', label: 'Plain Text (16pt)', font: 'Inter, sans-serif', size: 16, bold: false, bg: 'transparent', color: '#1c1917', icon: '📝' },
                    { id: 'title', label: 'Title / Heading 1 (28pt)', font: 'Inter, sans-serif', size: 28, bold: true, bg: 'transparent', color: '#1e293b', icon: '📌' },
                    { id: 'subhead', label: 'Subtitle / Heading 2 (20pt)', font: 'Inter, sans-serif', size: 20, bold: true, bg: 'transparent', color: '#334155', icon: '🏷️' },
                    { id: 'sticky-yellow', label: 'Yellow Sticky Note', font: 'Caveat, cursive', size: 20, bold: false, bg: '#fef08a', color: '#1c1917', icon: '🟡' },
                    { id: 'sticky-mint', label: 'Pastel Mint Sticky', font: 'Caveat, cursive', size: 20, bold: false, bg: '#bbf7d0', color: '#1c1917', icon: '🟢' },
                    { id: 'sticky-sky', label: 'Pastel Sky Sticky', font: 'Caveat, cursive', size: 20, bold: false, bg: '#bae6fd', color: '#1c1917', icon: '🔵' },
                    { id: 'sticky-rose', label: 'Pastel Rose Sticky', font: 'Caveat, cursive', size: 20, bold: false, bg: '#fce7f3', color: '#1c1917', icon: '🌸' },
                    { id: 'sticky-lavender', label: 'Soft Lavender Sticky', font: 'Caveat, cursive', size: 20, bold: false, bg: '#e9d5ff', color: '#1c1917', icon: '🟣' },
                    { id: 'card-dark', label: 'Dark Slate Note Card', font: 'Inter, sans-serif', size: 16, bold: false, bg: '#1e293b', color: '#ffffff', icon: '⚫' },
                    { id: 'card-code', label: 'Code Snippet Card', font: '"Courier New", monospace', size: 14, bold: false, bg: '#0f172a', color: '#38bdf8', icon: '💻' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onChangeTool('text');
                        if (onChangeShapeMode) onChangeShapeMode('none');
                        if (onApplyTextPreset) {
                          onApplyTextPreset({
                            fontFamily: preset.font,
                            fontSize: preset.size,
                            bold: preset.bold,
                            bg: preset.bg,
                            color: preset.color,
                          });
                        } else {
                          onChangeFontFamily(preset.font);
                          onChangeFontSize(preset.size);
                          if (isBold !== preset.bold) onToggleBold();
                          if (onChangeTextBg) onChangeTextBg(preset.bg);
                          onChangeColor(preset.color);
                        }
                        setTextPresetsOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{preset.icon}</span>
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Insert Image Tool (NoteIn APK Image Insertion) */}
          <button
            onClick={() => imageInputRef.current?.click()}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Insert Image (Add photos, diagrams, formulas, or stickers to your notes)"
          >
            <ImageIcon size={19} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onInsertImage) {
                onInsertImage(file);
              }
              e.target.value = '';
            }}
          />

          {/* Ruler Tool (Interactive Translucent Straightedge) */}
          <button
            onClick={() => {
              if (onToggleRuler) onToggleRuler();
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              color: isRulerActive ? '#3f52ff' : 'var(--text-secondary)',
              backgroundColor: isRulerActive ? 'rgba(63, 82, 255, 0.14)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Interactive Ruler (Drag, rotate, and draw laser-straight lines)"
          >
            <NoteinRuler size={19} />
          </button>

          {/* Collapse Pen Bar Action (Collapses only this pen toolbar without altering page view) */}
          <button
            onClick={() => {
              closeAllPopovers();
              setIsCollapsed(true);
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Collapse Pen Bar (Minimize to compact floating badge)"
          >
            <Minimize2 size={19} />
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: isVertical ? '32px' : '1px',
            height: isVertical ? '1px' : '22px',
            backgroundColor: 'var(--border-subtle)',
          }}
        />

        {/* GROUP 4: Color Swatches & Color Picker */}
        <div
          style={
            isVertical
              ? {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }
              : {
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '5px',
                }
          }
        >
          {/* Swatches Container */}
          <div
            style={
              isVertical
                ? {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '5px',
                    alignItems: 'center',
                    justifyItems: 'center',
                  }
                : {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }
            }
          >
            {QUICK_NOTEIN_COLORS.map((col) => (
              <button
                key={col}
                onClick={() => onChangeColor(col)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: col,
                  border: currentColor === col ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.15)',
                  boxShadow: currentColor === col ? '0 0 0 2px #3f52ff' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transform: currentColor === col ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                }}
                title={col}
              />
            ))}

            {/* Eyedropper / Palette Popover Trigger */}
            <button
              onClick={() => setColorOpen(!colorOpen)}
              style={{
                padding: '3px',
                borderRadius: '9999px',
                backgroundColor: colorOpen ? 'var(--bg-tertiary)' : 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Custom Palette & Eyedropper"
            >
              <NoteinColorPicker size={17} color={currentColor} />
            </button>
          </div>

          {/* Stroke Width Indicator Pill */}
          <button
            onClick={() => setWidthOpen(!widthOpen)}
            style={{
              padding: isVertical ? '3px 4px' : '3px 7px',
              borderRadius: '9999px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            title="Stroke Width (Click to customize)"
          >
            <span
              style={{
                width: `${Math.min(currentWidth, 6)}px`,
                height: `${Math.min(currentWidth, 6)}px`,
                borderRadius: '50%',
                backgroundColor: 'var(--text-primary)',
              }}
            />
            <span>{currentWidth}px</span>
          </button>
        </div>
      </div>
        )
      )}

      {/* =========================================================================
          POPOVERS (Positioned smartly relative to floating toolbar)
          ========================================================================= */}
      {/* Color Picker Popover */}
      {colorOpen && (
        <div
          className="animate-slide-down"
          style={{
            position: 'fixed',
            top: isVertical
              ? `${Math.max(60, Math.min(window.innerHeight - 340, currentPos.y + 100))}px`
              : `${currentPos.y + 60}px`,
            left: isVertical
              ? currentPos.x > window.innerWidth - 300
                ? `${currentPos.x - 260}px`
                : `${currentPos.x + 75}px`
              : `${Math.max(16, Math.min(window.innerWidth - 270, currentPos.x + 220))}px`,
            zIndex: 60,
          }}
        >
          <ColorPicker
            currentColor={currentColor}
            onSelectColor={(c: string) => {
              onChangeColor(c);
              setColorOpen(false);
            }}
            onClose={() => setColorOpen(false)}
          />
        </div>
      )}

      {/* Stroke Width Popover */}
      {widthOpen && (
        <div
          className="animate-slide-down"
          style={{
            position: 'fixed',
            top: isVertical
              ? `${Math.max(60, Math.min(window.innerHeight - 200, currentPos.y + 160))}px`
              : `${currentPos.y + 60}px`,
            left: isVertical
              ? currentPos.x > window.innerWidth - 260
                ? `${currentPos.x - 240}px`
                : `${currentPos.x + 75}px`
              : `${Math.max(16, Math.min(window.innerWidth - 250, currentPos.x + 360))}px`,
            zIndex: 60,
          }}
        >
          <StrokeWidthPicker
            currentWidth={currentWidth}
            onSelectWidth={(w: number) => {
              onChangeWidth(w);
              setWidthOpen(false);
            }}
            toolType={activeTool === 'highlighter' ? 'highlighter' : activeTool === 'eraser' ? 'eraser' : 'pen'}
          />
        </div>
      )}

      {/* Template Selector Modal */}
      {templateOpen && (
        <TemplateSelector
          isOpen={templateOpen}
          currentTemplate={currentTemplate}
          onSelectTemplate={(t: PaperTemplate) => {
            onChangeTemplate(t);
            setTemplateOpen(false);
          }}
          onClose={() => setTemplateOpen(false)}
        />
      )}

      {/* NoteIn Android Text Formatting Floating Sub-Bar */}
      {activeTool === 'text' && (
        <div
          className="glass-panel animate-slide-down"
          style={{
            position: 'fixed',
            top: isVertical ? '64px' : `${currentPos.y + 60}px`,
            left: isVertical ? `${currentPos.x + 75}px` : `${currentPos.x}px`,
            zIndex: 47,
            borderRadius: '9999px',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
            maxWidth: '96vw',
            overflowX: 'auto',
            backgroundColor: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
          }}
        >
          {/* Font Family Dropdown */}
          <select
            value={currentFontFamily}
            onChange={(e) => onChangeFontFamily(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Font Size with Stepper (- and +) */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-subtle)', padding: '1px' }}>
            <button
              onClick={() => onChangeFontSize(Math.max(8, currentFontSize - 2))}
              style={{
                padding: '2px 6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '4px',
              }}
              title="Decrease Font Size (-2pt)"
            >
              -
            </button>
            <select
              value={currentFontSize}
              onChange={(e) => onChangeFontSize(Number(e.target.value))}
              style={{
                padding: '3px 4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#3f52ff',
                fontSize: '11px',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}pt
                </option>
              ))}
            </select>
            <button
              onClick={() => onChangeFontSize(Math.min(72, currentFontSize + 2))}
              style={{
                padding: '2px 6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '4px',
              }}
              title="Increase Font Size (+2pt)"
            >
              +
            </button>
          </div>

          {/* Bold */}
          <button
            onClick={onToggleBold}
            style={{
              padding: '5px',
              borderRadius: '4px',
              backgroundColor: isBold ? 'rgba(63, 82, 255, 0.15)' : 'transparent',
              color: isBold ? '#3f52ff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Bold"
          >
            <Bold size={14} />
          </button>

          {/* Italic */}
          <button
            onClick={onToggleItalic}
            style={{
              padding: '5px',
              borderRadius: '4px',
              backgroundColor: isItalic ? 'rgba(63, 82, 255, 0.15)' : 'transparent',
              color: isItalic ? '#3f52ff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Italic"
          >
            <Italic size={14} />
          </button>

          {/* Underline */}
          {onToggleUnderline && (
            <button
              onClick={onToggleUnderline}
              style={{
                padding: '5px',
                borderRadius: '4px',
                backgroundColor: isUnderline ? 'rgba(63, 82, 255, 0.15)' : 'transparent',
                color: isUnderline ? '#3f52ff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Underline"
            >
              <UnderlineIcon size={14} />
            </button>
          )}

          {/* Strikethrough */}
          {onToggleStrikethrough && (
            <button
              onClick={onToggleStrikethrough}
              style={{
                padding: '5px',
                borderRadius: '4px',
                backgroundColor: isStrikethrough ? 'rgba(63, 82, 255, 0.15)' : 'transparent',
                color: isStrikethrough ? '#3f52ff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Strikethrough"
            >
              <StrikethroughIcon size={14} />
            </button>
          )}

          {/* Text Alignment */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => onChangeAlignment('left')}
              style={{
                padding: '4px',
                border: 'none',
                background: alignment === 'left' ? 'var(--bg-tertiary)' : 'transparent',
                color: alignment === 'left' ? '#3f52ff' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              <AlignLeft size={13} />
            </button>
            <button
              onClick={() => onChangeAlignment('center')}
              style={{
                padding: '4px',
                border: 'none',
                background: alignment === 'center' ? 'var(--bg-tertiary)' : 'transparent',
                color: alignment === 'center' ? '#3f52ff' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              <AlignCenter size={13} />
            </button>
            <button
              onClick={() => onChangeAlignment('right')}
              style={{
                padding: '4px',
                border: 'none',
                background: alignment === 'right' ? 'var(--bg-tertiary)' : 'transparent',
                color: alignment === 'right' ? '#3f52ff' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              <AlignRight size={13} />
            </button>
          </div>

          {/* Sticky Note / Card Background Fill Swatches */}
          {onChangeTextBg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Card:</span>
              {[
                { bg: 'transparent', label: 'Plain' },
                { bg: '#fef08a', label: 'Yellow Sticky' },
                { bg: '#bbf7d0', label: 'Mint Sticky' },
                { bg: '#bae6fd', label: 'Sky Sticky' },
                { bg: '#fce7f3', label: 'Rose Sticky' },
                { bg: '#e9d5ff', label: 'Lavender Sticky' },
                { bg: '#1e293b', label: 'Dark Slate' },
              ].map((c) => (
                <button
                  key={c.bg}
                  onClick={() => onChangeTextBg(c.bg)}
                  title={c.label}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: c.bg === 'transparent' ? '#ffffff' : c.bg,
                    border: currentTextBg === c.bg ? '2px solid #3f52ff' : c.bg === 'transparent' ? '1px dashed #94a3b8' : '1px solid rgba(0,0,0,0.18)',
                    cursor: 'pointer',
                    padding: 0,
                    transform: currentTextBg === c.bg ? 'scale(1.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Text Color Swatches + Custom Color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '6px' }}>
            {[
              { color: '#1c1917', label: 'Black' },
              { color: '#1d4ed8', label: 'Royal Blue' },
              { color: '#dc2626', label: 'Crimson' },
              { color: '#16a34a', label: 'Green' },
              { color: '#7c3aed', label: 'Purple' },
              { color: '#ffffff', label: 'White' },
            ].map((c) => (
              <button
                key={c.color}
                onClick={() => onChangeColor(c.color)}
                title={c.label}
                style={{
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  backgroundColor: c.color,
                  border: currentColor === c.color ? '2px solid #3f52ff' : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                  transform: currentColor === c.color ? 'scale(1.15)' : 'none',
                }}
              />
            ))}
            <button
              onClick={() => setColorOpen(!colorOpen)}
              title="More Text Colors"
              style={{
                padding: '2px 4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Palette size={13} />
            </button>
          </div>

          {/* Bullet List */}
          {onInsertBullet && (
            <button
              onClick={onInsertBullet}
              style={{ padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Bullet List"
            >
              <List size={14} />
            </button>
          )}

          {/* Code Block */}
          {onInsertCode && (
            <button
              onClick={onInsertCode}
              style={{ padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Insert Code Block"
            >
              <CodeIcon size={14} />
            </button>
          )}

          {/* Duplicate Text Box */}
          {onDuplicateTextBox && (
            <button
              type="button"
              onClick={onDuplicateTextBox}
              disabled={!selectedTextBoxId}
              style={{
                padding: '5px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: selectedTextBoxId ? 'var(--text-secondary)' : 'var(--text-muted, #94a3b8)',
                cursor: selectedTextBoxId ? 'pointer' : 'not-allowed',
                opacity: selectedTextBoxId ? 1 : 0.4,
              }}
              title="Duplicate Text Box"
            >
              <Copy size={14} />
            </button>
          )}

          {/* Delete Text Box */}
          {onDeleteTextBox && (
            <button
              type="button"
              onClick={onDeleteTextBox}
              disabled={!selectedTextBoxId}
              style={{
                padding: '5px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: selectedTextBoxId ? 'var(--danger, #ef4444)' : 'var(--text-muted, #94a3b8)',
                cursor: selectedTextBoxId ? 'pointer' : 'not-allowed',
                opacity: selectedTextBoxId ? 1 : 0.4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Delete Text Box (Del)"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </>
  );
};
