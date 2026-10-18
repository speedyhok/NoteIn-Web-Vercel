import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  PenTool,
  Highlighter,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  FilePlus,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Check,
  Loader2,
  LayoutGrid
} from 'lucide-react';
import type { ToolType, PaperTemplate } from '../../types';
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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitPage: () => void;
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

export const Toolbar: React.FC<ToolbarProps> = ({
  notebookTitle,
  onBack,
  activeTool,
  onChangeTool,
  currentColor,
  onChangeColor,
  currentWidth,
  onChangeWidth,
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

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setColorOpen(false);
        setWidthOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: 'var(--radius-full)',
        maxWidth: '96vw',
        overflowX: 'auto',
      }}
      className="glass-panel"
    >
      {/* 1. Navigation & Title Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
          title="Back to Notebooks"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: '13px', fontWeight: 600, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {notebookTitle}
          </span>
        </button>

        {/* Autosave Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            padding: '0 4px',
          }}
          title={isSaving ? 'Saving changes to IndexedDB...' : 'All changes saved locally'}
        >
          {isSaving ? (
            <>
              <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ display: 'none' }}>Saving</span>
            </>
          ) : (
            <>
              <Check size={12} color="var(--success)" />
              <span style={{ display: 'none' }}>Saved</span>
            </>
          )}
        </div>
      </div>

      <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

      {/* 2. Drawing Tools Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Pen Tool */}
        <button
          onClick={() => onChangeTool('pen')}
          style={{
            padding: '7px 11px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: activeTool === 'pen' ? 'var(--accent-primary)' : 'transparent',
            color: activeTool === 'pen' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTool === 'pen' ? '0 2px 8px var(--accent-glow)' : 'none',
          }}
          title="Pen (Pressure Sensitive)"
        >
          <PenTool size={16} />
        </button>

        {/* Highlighter Tool */}
        <button
          onClick={() => onChangeTool('highlighter')}
          style={{
            padding: '7px 11px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: activeTool === 'highlighter' ? 'var(--accent-primary)' : 'transparent',
            color: activeTool === 'highlighter' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTool === 'highlighter' ? '0 2px 8px var(--accent-glow)' : 'none',
          }}
          title="Highlighter (Translucent)"
        >
          <Highlighter size={16} />
        </button>

        {/* Stroke Eraser Tool */}
        <button
          onClick={() => onChangeTool('eraser')}
          style={{
            padding: '7px 11px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: activeTool === 'eraser' ? 'var(--accent-primary)' : 'transparent',
            color: activeTool === 'eraser' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTool === 'eraser' ? '0 2px 8px var(--accent-glow)' : 'none',
          }}
          title="Stroke Eraser"
        >
          <Eraser size={16} />
        </button>

        {/* Hand / Pan Tool */}
        <button
          onClick={() => onChangeTool('pan')}
          style={{
            padding: '7px 11px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: activeTool === 'pan' ? 'var(--accent-primary)' : 'transparent',
            color: activeTool === 'pan' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: activeTool === 'pan' ? '0 2px 8px var(--accent-glow)' : 'none',
          }}
          title="Pan / Navigation Tool"
        >
          <Hand size={16} />
        </button>

        {/* Color Popover Trigger */}
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

        {/* Stroke Width Popover Trigger */}
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

      <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

      {/* 3. Undo / Redo Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={{
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: canUndo ? 1 : 0.45,
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
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: canRedo ? 1 : 0.45,
            cursor: canRedo ? 'pointer' : 'default',
          }}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

      {/* 4. Zoom Controls Section */}
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
            minWidth: '40px',
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

      <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

      {/* 5. Page Navigation & Template Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Previous Page */}
        <button
          onClick={onPrevPage}
          disabled={currentPageIndex <= 0}
          style={{
            padding: '6px 6px',
            borderRadius: 'var(--radius-sm)',
            color: currentPageIndex > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: currentPageIndex > 0 ? 1 : 0.4,
            cursor: currentPageIndex > 0 ? 'pointer' : 'default',
          }}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page Drawer Button */}
        <button
          onClick={onTogglePageDrawer}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
          title="View Page Thumbnails"
        >
          <Layers size={13} style={{ marginRight: '4px' }} />
          {currentPageIndex + 1} / {totalPages}
        </button>

        {/* Next Page */}
        <button
          onClick={onNextPage}
          disabled={currentPageIndex >= totalPages - 1}
          style={{
            padding: '6px 6px',
            borderRadius: 'var(--radius-sm)',
            color: currentPageIndex < totalPages - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
            opacity: currentPageIndex < totalPages - 1 ? 1 : 0.4,
            cursor: currentPageIndex < totalPages - 1 ? 'pointer' : 'default',
          }}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>

        {/* Add Page Button */}
        <button
          onClick={onAddPage}
          style={{
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-primary)',
          }}
          title="Add New Page"
        >
          <FilePlus size={15} />
        </button>

        {/* Paper Template Button */}
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

        {/* Theme Toggle */}
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

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={templateOpen}
        onClose={() => setTemplateOpen(false)}
        currentTemplate={currentTemplate}
        onSelectTemplate={onChangeTemplate}
      />
    </div>
  );
};
