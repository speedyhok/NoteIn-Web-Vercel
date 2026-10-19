import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TextBox } from '../../types';
import { Trash2, GripHorizontal, Edit3, Copy } from 'lucide-react';

interface TextBoxItemProps {
  textBox: TextBox;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onEndEditing: (newContent: string) => void;
  onUpdatePosition: (newX: number, newY: number) => void;
  onCommitPosition: (oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateSize: (newWidth: number, newHeight: number) => void;
  onCommitSize: (oldW: number, oldH: number, newW: number, newH: number) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  zoom: number;
}

export const TextBoxItem: React.FC<TextBoxItemProps> = ({
  textBox,
  isSelected,
  isEditing,
  onSelect,
  onStartEditing,
  onEndEditing,
  onUpdatePosition,
  onCommitPosition,
  onUpdateSize,
  onCommitSize,
  onDelete,
  onDuplicate,
  zoom,
}) => {
  // Normalize content: if it is literally 'Click to edit...' treat as empty
  const initialContent = textBox.content === 'Click to edit...' || textBox.content === 'Click to edit'
    ? ''
    : textBox.content;

  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Sync content when prop changes
  useEffect(() => {
    const cleanContent = textBox.content === 'Click to edit...' || textBox.content === 'Click to edit'
      ? ''
      : textBox.content;
    setContent(cleanContent);
  }, [textBox.content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Measure and auto-expand text box dimensions to fit content
  const autoExpandDimensions = useCallback((text: string, ta?: HTMLTextAreaElement | null) => {
    const lines = text.split(/\r?\n/);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let maxLineWidth = 0;
    if (ctx) {
      const weight = textBox.bold ? 'bold ' : '';
      const style = textBox.italic ? 'italic ' : '';
      ctx.font = `${style}${weight}${textBox.fontSize}px ${textBox.fontFamily || 'Inter, sans-serif'}`;
      for (const line of lines) {
        // Expand tab characters to 4 spaces for measurement
        const expandedLine = line.replace(/\t/g, '    ');
        const metrics = ctx.measureText(expandedLine);
        if (metrics.width > maxLineWidth) {
          maxLineWidth = metrics.width;
        }
      }
    }

    // Required width: longest line + 36px padding for borders
    const neededWidth = Math.ceil(maxLineWidth + 36);
    // Expand width up to 960px max width
    const targetWidth = Math.max(textBox.width, Math.min(960, neededWidth));

    // Required height: line count or scrollHeight
    const estimatedLineHeight = textBox.fontSize * 1.45;
    const estimatedHeight = Math.ceil(lines.length * estimatedLineHeight + 24);
    const scrollH = ta ? ta.scrollHeight + 16 : 0;
    const targetHeight = Math.max(textBox.height, Math.max(scrollH, estimatedHeight));

    if (targetWidth !== textBox.width || targetHeight !== textBox.height) {
      onUpdateSize(targetWidth, targetHeight);
      onCommitSize(textBox.width, textBox.height, targetWidth, targetHeight);
    }
  }, [textBox.width, textBox.height, textBox.bold, textBox.italic, textBox.fontSize, textBox.fontFamily, onUpdateSize, onCommitSize]);

  // Drag on Card Body (when in viewing mode) or Grip Handle
  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    // Only drag with primary left mouse button
    if (e.button !== 0) return;

    // CRITICAL: Stop propagation so canvas doesn't create new text box or draw strokes
    e.stopPropagation();

    // If user is inside the textarea while editing, allow standard text cursor/selection
    const isInsideTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (isEditing && isInsideTextarea) {
      return;
    }

    try {
      if ('pointerId' in e) (e.currentTarget as any).setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: textBox.x,
      origY: textBox.y,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - dragStartRef.current.clientY) / zoom;

    // Movement threshold to distinguish drag from click
    if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
      dragStartRef.current.hasMoved = true;
    }

    if (dragStartRef.current.hasMoved) {
      const newX = Math.round(dragStartRef.current.origX + dx);
      const newY = Math.round(dragStartRef.current.origY + dy);
      onUpdatePosition(newX, newY);
    }
  };

  const handleStartEdit = useCallback(() => {
    if (content === 'Click to edit...' || content === 'Click to edit') {
      setContent('');
    }
    onSelect();
    onStartEditing();
  }, [content, onSelect, onStartEditing]);

  const handlePointerUp = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();

    if ('pointerId' in e) {
      try {
        (e.currentTarget as any).releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (dragStartRef.current) {
      const { origX, origY, hasMoved } = dragStartRef.current;
      dragStartRef.current = null;

      if (hasMoved) {
        if (textBox.x !== origX || textBox.y !== origY) {
          onCommitPosition(origX, origY, textBox.x, textBox.y);
        }
        return;
      }
    }

    handleStartEdit();
  };

  // Handle Resize
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      if ('pointerId' in e) (e.currentTarget as any).setPointerCapture(e.pointerId);
    } catch {}

    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origW: textBox.width,
      origH: textBox.height,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - resizeStartRef.current.clientX) / zoom;
    const dy = (e.clientY - resizeStartRef.current.clientY) / zoom;

    const newW = Math.max(80, Math.round(resizeStartRef.current.origW + dx));
    const newH = Math.max(30, Math.round(resizeStartRef.current.origH + dy));

    onUpdateSize(newW, newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    try {
      if ('pointerId' in e) (e.currentTarget as any).releasePointerCapture(e.pointerId);
    } catch {}

    const { origW, origH } = resizeStartRef.current;
    resizeStartRef.current = null;

    if (textBox.width !== origW || textBox.height !== origH) {
      onCommitSize(origW, origH, textBox.width, textBox.height);
    }
  };

  // Blur / Commit editing
  const handleBlur = () => {
    onEndEditing(content);
  };

  // Keyboard shortcut handlers (Escape, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      onEndEditing(content);
      return;
    }

    // Support Tab key indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const updated = content.substring(0, start) + '    ' + content.substring(end);
      setContent(updated);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  // Handle Paste: preserve exact formatting (tabs, indentation, newlines) and auto-expand
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const updated = content.substring(0, start) + text + content.substring(end);
    setContent(updated);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
        autoExpandDimensions(updated, textareaRef.current);
      }
    }, 0);
  };

  // Dynamic auto-grow on text input
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    // Auto-expand height if content grows
    if (textareaRef.current) {
      const scrollH = textareaRef.current.scrollHeight + 16;
      if (scrollH > textBox.height) {
        onUpdateSize(textBox.width, scrollH);
        onCommitSize(textBox.width, textBox.height, textBox.width, scrollH);
      }
    }
  };

  // Text decorations
  const textDecorations: string[] = [];
  if (textBox.underline) textDecorations.push('underline');
  if (textBox.strikethrough) textDecorations.push('line-through');
  const textDecoration = textDecorations.length > 0 ? textDecorations.join(' ') : 'none';

  const bgColor = textBox.backgroundColor || 'transparent';
  const hasCustomBg = bgColor !== 'transparent';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onMouseDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onMouseMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        handleStartEdit();
      }}
      style={{
        position: 'absolute',
        left: `${textBox.x}px`,
        top: `${textBox.y}px`,
        width: `${textBox.width}px`,
        minHeight: `${textBox.height}px`,
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : isSelected ? 'move' : 'pointer',
        userSelect: isEditing ? 'text' : 'none',
        border: isSelected
          ? '1.5px dashed var(--accent-primary)'
          : textBox.borderColor && textBox.borderColor !== 'transparent'
          ? `1.5px solid ${textBox.borderColor}`
          : '1.5px solid transparent',
        borderRadius: `${textBox.borderRadius || 6}px`,
        padding: '6px 8px',
        backgroundColor: hasCustomBg ? bgColor : isSelected ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
        boxShadow: hasCustomBg ? '0 4px 14px rgba(0, 0, 0, 0.08)' : 'none',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Floating Selection Action Bar (Move Grip, Edit, Duplicate, Delete) */}
      {isSelected && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            top: '-28px',
            left: '0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '2px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            cursor: 'grab',
            zIndex: 20,
          }}
        >
          <GripHorizontal size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, userSelect: 'none' }}>
            Move
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (content === 'Click to edit...' || content === 'Click to edit') {
                setContent('');
              }
              onStartEditing();
            }}
            title="Edit Text"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Edit3 size={12} />
          </button>

          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate Text Box"
              style={{
                padding: '2px 4px',
                borderRadius: '2px',
                color: 'var(--text-secondary)',
              }}
            >
              <Copy size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Text Box"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--danger)',
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Editing Mode: Auto-focused Textarea (Empty placeholder so NO 'Click to edit' lingers) */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder=""
          style={{
            width: '100%',
            height: '100%',
            minHeight: `${textBox.height - 14}px`,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            resize: 'none',
            fontFamily: textBox.fontFamily,
            fontSize: `${textBox.fontSize}px`,
            color: textBox.color,
            fontWeight: textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: textBox.alignment,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            tabSize: 4,
            MozTabSize: 4,
            padding: 0,
            margin: 0,
          }}
        />
      ) : (
        /* Viewing Mode */
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
          style={{
            width: '100%',
            minHeight: `${textBox.height - 14}px`,
            fontFamily: textBox.fontFamily,
            fontSize: `${textBox.fontSize}px`,
            color: textBox.color,
            fontWeight: textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: textBox.alignment,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            tabSize: 4,
            MozTabSize: 4,
            cursor: isSelected ? 'move' : 'text',
          }}
        >
          {content ? (
            content
          ) : (
            <span
              style={{
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Click to edit...
            </span>
          )}
        </div>
      )}

      {/* Resize Handle (Bottom-Right) */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          style={{
            position: 'absolute',
            right: '-5px',
            bottom: '-5px',
            width: '10px',
            height: '10px',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: '2px',
            cursor: 'nwse-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};
