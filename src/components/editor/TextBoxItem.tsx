import React, { useState, useRef, useEffect } from 'react';
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
  const [content, setContent] = useState(textBox.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; origW: number; origH: number } | null>(null);

  // Sync content when prop changes
  useEffect(() => {
    setContent(textBox.content);
  }, [textBox.content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Handle Drag / Move
  const handleMovePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: textBox.x,
      origY: textBox.y,
    };
  };

  const handleMovePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - dragStartRef.current.clientY) / zoom;

    onUpdatePosition(
      Math.round(dragStartRef.current.origX + dx),
      Math.round(dragStartRef.current.origY + dy)
    );
  };

  const handleMovePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { origX, origY } = dragStartRef.current;
    dragStartRef.current = null;

    if (textBox.x !== origX || textBox.y !== origY) {
      onCommitPosition(origX, origY, textBox.x, textBox.y);
    }
  };

  // Handle Resize
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
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
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { origW, origH } = resizeStartRef.current;
    resizeStartRef.current = null;

    if (textBox.width !== origW || textBox.height !== origH) {
      onCommitSize(origW, origH, textBox.width, textBox.height);
    }
  };

  const handleBlur = () => {
    onEndEditing(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      onEndEditing(content);
    }
  };

  // Text decoration computation
  const textDecorations: string[] = [];
  if (textBox.underline) textDecorations.push('underline');
  if (textBox.strikethrough) textDecorations.push('line-through');
  const textDecoration = textDecorations.length > 0 ? textDecorations.join(' ') : 'none';

  const bgColor = textBox.backgroundColor || 'transparent';
  const hasCustomBg = bgColor !== 'transparent';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        // Immediately start editing on click
        onStartEditing();
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
      {/* Selection Action Bar (Move Grip, Edit, Duplicate, Delete) */}
      {isSelected && (
        <div
          onPointerDown={handleMovePointerDown}
          onPointerMove={handleMovePointerMove}
          onPointerUp={handleMovePointerUp}
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

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
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

      {/* Editing Mode: Auto-focused Textarea */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type something..."
          style={{
            width: '100%',
            height: '100%',
            minHeight: `${textBox.height - 12}px`,
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
            padding: 0,
            margin: 0,
          }}
        />
      ) : (
        /* Viewing Mode: Click immediately starts editing */
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
            onStartEditing();
          }}
          style={{
            width: '100%',
            minHeight: `${textBox.height - 12}px`,
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
            cursor: 'text',
          }}
        >
          {content || (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
