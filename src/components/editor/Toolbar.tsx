import React, { useState } from 'react';
import type { ToolType, PaperTemplate } from '../../types';
import {
  Pen,
  Highlighter,
  Eraser,
  Type,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  Layers,
  LayoutGrid,
  Sun,
  Moon,
  ArrowLeft,
  Check,
  Loader2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { StrokeWidthPicker } from './StrokeWidthPicker';
import { TemplateSelector } from './TemplateSelector';

interface ToolbarProps {
  notebookTitle: string;
  onBack: () => void;
  activeTool: ToolType;
  onChangeTool: (tool: ToolType) => void;
  currentColor: string;
  onChangeColor: (color: string) => void;
  currentWidth: number;
  onChangeWidth: (width: number) => void;
  // Text formatting
  currentFontFamily: string;
  onChangeFontFamily: (font: string) => void;
  currentFontSize: number;
  onChangeFontSize: (size: number) => void;
  isBold: boolean;
  onToggleBold: () => void;
  isItalic: boolean;
  onToggleItalic: () => void;
  alignment: 'left' | 'center' | 'right';
  onChangeAlignment: (align: 'left' | 'center' | 'right') => void;
  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Zoom
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitPage: () => void;
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
}

const FONT_FAMILIES = [
  { label: 'Inter (Sans)', value: 'Inter, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Courier (Mono)', value: '"Courier New", monospace' },
  { label: 'Caveat (Script)', value: 'Caveat, cursive' },
  { label: 'Arial', value: 'Arial, sans-serif' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 32, 40];

export const Toolbar: React.FC<ToolbarProps> = ({
  notebookTitle,
  onBack,
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
  alignment,
  onChangeAlignment,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitPage,
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
}) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [widthOpen, setWidthOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <>
      {/* Top Header Bar */}
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
        {/* Left: Back & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-tertiary)',
            }}
            title="Back to Notebooks"
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Library</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {notebookTitle}
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: isSaving ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              <span>{isSaving ? 'Saving...' : 'Saved'}</span>
            </div>
          </div>
        </div>

        {/* Right: Page navigation, Template, & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={onPrevPage}
            disabled={currentPageIndex <= 0}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: currentPageIndex > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: currentPageIndex > 0 ? 1 : 0.4,
              cursor: currentPageIndex > 0 ? 'pointer' : 'default',
            }}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={onTogglePageDrawer}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
            title="View Page Thumbnails"
          >
            <Layers size={13} style={{ marginRight: '6px' }} />
            Page {currentPageIndex + 1} / {totalPages}
          </button>

          <button
            onClick={onNextPage}
            disabled={currentPageIndex >= totalPages - 1}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: currentPageIndex < totalPages - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: currentPageIndex < totalPages - 1 ? 1 : 0.4,
              cursor: currentPageIndex < totalPages - 1 ? 'pointer' : 'default',
            }}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={onAddPage}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-light)',
            }}
            title="Add New Page"
          >
            <FilePlus size={15} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Page</span>
          </button>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

          <button
            onClick={() => setTemplateOpen(true)}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
            title="Change Paper Template"
          >
            <LayoutGrid size={15} />
          </button>

          <button
            onClick={onToggleTheme}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Floating Center Studio Pill Toolbar */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 35,
          borderRadius: 'var(--radius-full)',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--glass-shadow)',
          maxWidth: '96vw',
          overflowX: 'auto',
        }}
      >
        {/* 1. Core Tool Palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {/* Pen */}
          <button
            onClick={() => onChangeTool('pen')}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              color: activeTool === 'pen' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'pen' ? 'var(--accent-primary)' : 'transparent',
            }}
            title="Pen (1)"
          >
            <Pen size={15} />
          </button>

          {/* Highlighter */}
          <button
            onClick={() => onChangeTool('highlighter')}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              color: activeTool === 'highlighter' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'highlighter' ? 'var(--accent-primary)' : 'transparent',
            }}
            title="Highlighter (2)"
          >
            <Highlighter size={15} />
          </button>

          {/* Eraser */}
          <button
            onClick={() => onChangeTool('eraser')}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              color: activeTool === 'eraser' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'eraser' ? 'var(--accent-primary)' : 'transparent',
            }}
            title="Stroke Eraser (3)"
          >
            <Eraser size={15} />
          </button>

          {/* Text Tool */}
          <button
            onClick={() => onChangeTool('text')}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              color: activeTool === 'text' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'text' ? 'var(--accent-primary)' : 'transparent',
            }}
            title="Text Tool (Click paper to type)"
          >
            <Type size={15} />
          </button>

          {/* Hand / Pan */}
          <button
            onClick={() => onChangeTool('pan')}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              color: activeTool === 'pan' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeTool === 'pan' ? 'var(--accent-primary)' : 'transparent',
            }}
            title="Hand / Pan (4 or Space)"
          >
            <Hand size={15} />
          </button>
        </div>

        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)' }} />

        {/* 2. Contextual Tool Settings */}
        {activeTool === 'text' ? (
          /* Text Tool Controls */
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Font Family Selector */}
            <select
              value={currentFontFamily}
              onChange={(e) => onChangeFontFamily(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Font Family"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font Size Selector */}
            <select
              value={currentFontSize}
              onChange={(e) => onChangeFontSize(Number(e.target.value))}
              style={{
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Font Size"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}pt
                </option>
              ))}
            </select>

            {/* Bold Toggle */}
            <button
              onClick={onToggleBold}
              style={{
                padding: '5px 7px',
                borderRadius: 'var(--radius-sm)',
                color: isBold ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: isBold ? 'var(--accent-light)' : 'transparent',
                fontWeight: 'bold',
              }}
              title="Bold"
            >
              <Bold size={14} />
            </button>

            {/* Italic Toggle */}
            <button
              onClick={onToggleItalic}
              style={{
                padding: '5px 7px',
                borderRadius: 'var(--radius-sm)',
                color: isItalic ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: isItalic ? 'var(--accent-light)' : 'transparent',
                fontStyle: 'italic',
              }}
              title="Italic"
            >
              <Italic size={14} />
            </button>

            {/* Alignment Toggles */}
            <button
              onClick={() => onChangeAlignment('left')}
              style={{
                padding: '5px 6px',
                borderRadius: 'var(--radius-sm)',
                color: alignment === 'left' ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: alignment === 'left' ? 'var(--accent-light)' : 'transparent',
              }}
              title="Align Left"
            >
              <AlignLeft size={14} />
            </button>
            <button
              onClick={() => onChangeAlignment('center')}
              style={{
                padding: '5px 6px',
                borderRadius: 'var(--radius-sm)',
                color: alignment === 'center' ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: alignment === 'center' ? 'var(--accent-light)' : 'transparent',
              }}
              title="Align Center"
            >
              <AlignCenter size={14} />
            </button>
            <button
              onClick={() => onChangeAlignment('right')}
              style={{
                padding: '5px 6px',
                borderRadius: 'var(--radius-sm)',
                color: alignment === 'right' ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: alignment === 'right' ? 'var(--accent-light)' : 'transparent',
              }}
              title="Align Right"
            >
              <AlignRight size={14} />
            </button>

            {/* Text Color Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setColorOpen(!colorOpen);
                  setWidthOpen(false);
                }}
                style={{
                  padding: '5px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Text Color"
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: currentColor,
                    border: '1.5px solid #ffffff',
                    boxShadow: '0 0 0 1px var(--border-strong)',
                  }}
                />
              </button>

              {colorOpen && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' }}>
                  <ColorPicker
                    currentColor={currentColor}
                    onSelectColor={onChangeColor}
                    onClose={() => setColorOpen(false)}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Pen / Highlighter / Eraser Controls */
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Color Swatch */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setColorOpen(!colorOpen);
                  setWidthOpen(false);
                }}
                style={{
                  padding: '6px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Ink Color"
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: currentColor,
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 1px var(--border-strong)',
                  }}
                />
              </button>

              {colorOpen && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' }}>
                  <ColorPicker
                    currentColor={currentColor}
                    onSelectColor={onChangeColor}
                    onClose={() => setColorOpen(false)}
                  />
                </div>
              )}
            </div>

            {/* Width Picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setWidthOpen(!widthOpen);
                  setColorOpen(false);
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-tertiary)',
                }}
                title="Stroke Width"
              >
                <div
                  style={{
                    width: '14px',
                    height: `${Math.min(10, Math.max(2, currentWidth))}px`,
                    backgroundColor: 'var(--text-primary)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </button>

              {widthOpen && (
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' }}>
                  <StrokeWidthPicker
                    currentWidth={currentWidth}
                    onSelectWidth={onChangeWidth}
                    toolType={activeTool === 'highlighter' ? 'highlighter' : activeTool === 'eraser' ? 'eraser' : 'pen'}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)' }} />

        {/* 3. Reactive Undo / Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              padding: '7px 9px',
              borderRadius: 'var(--radius-sm)',
              color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: canUndo ? 1 : 0.35,
              cursor: canUndo ? 'pointer' : 'default',
            }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              padding: '7px 9px',
              borderRadius: 'var(--radius-sm)',
              color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: canRedo ? 1 : 0.35,
              cursor: canRedo ? 'pointer' : 'default',
            }}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)' }} />

        {/* 4. Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={onZoomOut}
            style={{ padding: '6px 7px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={onResetZoom}
            style={{
              padding: '4px 6px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: '38px',
              textAlign: 'center',
            }}
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            style={{ padding: '6px 7px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={onFitPage}
            style={{ padding: '6px 7px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
            title="Fit Page to Screen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={templateOpen}
        onClose={() => setTemplateOpen(false)}
        currentTemplate={currentTemplate}
        onSelectTemplate={onChangeTemplate}
      />
    </>
  );
};
