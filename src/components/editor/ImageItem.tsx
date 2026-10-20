import React, { useRef, useState } from 'react';
import type { NoteImage } from '../../types';
import { GripVertical, Trash2, Copy } from 'lucide-react';

interface ImageItemProps {
  image: NoteImage;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (newX: number, newY: number) => void;
  onCommitPosition: (oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateSize: (newW: number, newH: number) => void;
  onCommitSize: (oldW: number, oldH: number, newW: number, newH: number) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  zoom: number;
  canInteract: boolean;
}

export const ImageItem: React.FC<ImageItemProps> = ({
  image,
  isSelected,
  onSelect,
  onUpdatePosition,
  onCommitPosition,
  onUpdateSize,
  onCommitSize,
  onDelete,
  onDuplicate,
  zoom,
  canInteract,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
    lastX: number;
    lastY: number;
    hasMoved: boolean;
  } | null>(null);

  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    origW: number;
    origH: number;
    lastW: number;
    lastH: number;
  } | null>(null);

  // Drag Image
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !canInteract) return;
    e.stopPropagation();
    e.preventDefault();

    onSelect();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: image.x,
      origY: image.y,
      lastX: image.x,
      lastY: image.y,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - dragStartRef.current.clientY) / zoom;

    if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 2) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragStartRef.current.hasMoved) {
      const newX = Math.round(dragStartRef.current.origX + dx);
      const newY = Math.round(dragStartRef.current.origY + dy);
      dragStartRef.current.lastX = newX;
      dragStartRef.current.lastY = newY;
      onUpdatePosition(newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { origX, origY, lastX, lastY, hasMoved } = dragStartRef.current;
    dragStartRef.current = null;
    setIsDragging(false);

    if (hasMoved) {
      onCommitPosition(origX, origY, lastX, lastY);
    }
  };

  // Resize Image (Bottom-Right Handle)
  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !canInteract) return;
    e.stopPropagation();
    e.preventDefault();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origW: image.width,
      origH: image.height,
      lastW: image.width,
      lastH: image.height,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = (e.clientX - resizeStartRef.current.clientX) / zoom;
    const dy = (e.clientY - resizeStartRef.current.clientY) / zoom;

    const newW = Math.max(40, Math.round(resizeStartRef.current.origW + dx));
    const newH = Math.max(40, Math.round(resizeStartRef.current.origH + dy));

    resizeStartRef.current.lastW = newW;
    resizeStartRef.current.lastH = newH;
    onUpdateSize(newW, newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { origW, origH, lastW, lastH } = resizeStartRef.current;
    resizeStartRef.current = null;
    onCommitSize(origW, origH, lastW, lastH);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
        if (!canInteract) return;
        e.stopPropagation();
        onSelect();
      }}
      style={{
        position: 'absolute',
        left: `${image.x}px`,
        top: `${image.y}px`,
        width: `${image.width}px`,
        height: `${image.height}px`,
        transform: image.rotation ? `rotate(${image.rotation}deg)` : 'none',
        transformOrigin: 'center center',
        boxSizing: 'border-box',
        cursor: isDragging ? 'grabbing' : canInteract ? (isSelected ? 'move' : 'pointer') : 'default',
        userSelect: 'none',
        pointerEvents: canInteract ? 'auto' : 'none',
        border: isSelected
          ? '2px dashed #3f52ff'
          : canInteract
          ? '1.5px solid transparent'
          : 'none',
        borderRadius: '6px',
        boxShadow: isSelected ? '0 0 0 1px rgba(255,255,255,0.8), 0 4px 16px rgba(63, 82, 255, 0.25)' : 'none',
        transition: isDragging ? 'none' : 'border-color 0.15s ease',
      }}
    >
      {/* Floating Action Menu when Image is Selected */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '-32px',
            left: '0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '2px 6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 30,
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#3f52ff', fontSize: '11px', fontWeight: 700, paddingRight: '4px' }}>
            <GripVertical size={13} />
            <span>Move Image</span>
          </div>

          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate Image"
              style={{
                padding: '3px 5px',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Copy size={12} />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Image"
            style={{
              padding: '3px 5px',
              borderRadius: '4px',
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Rendered Image Graphic */}
      <img
        src={image.src}
        alt="Page Element"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '4px',
          opacity: image.opacity !== undefined ? image.opacity : 1.0,
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block',
        }}
      />

      {/* Corner Resize Handle (Bottom-Right) */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          style={{
            position: 'absolute',
            bottom: '-6px',
            right: '-6px',
            width: '14px',
            height: '14px',
            backgroundColor: '#3f52ff',
            border: '2px solid #ffffff',
            borderRadius: '50%',
            cursor: 'nwse-resize',
            zIndex: 25,
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          }}
          title="Drag to Resize Image"
        />
      )}
    </div>
  );
};
