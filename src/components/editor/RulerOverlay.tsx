import React, { useState, useRef } from 'react';
import type { ViewportTransform } from '../../types';
import { RotateCw, Move, X } from 'lucide-react';

export interface RulerState {
  x: number; // Page coordinates
  y: number; // Page coordinates
  angle: number; // Degrees
  length: number; // Page pt (default 400 pt ~ 14 cm)
}

interface RulerOverlayProps {
  isActive: boolean;
  onClose: () => void;
  transform: ViewportTransform;
  rulerState: RulerState;
  onRulerChange: (nextState: RulerState) => void;
  isDarkMode: boolean;
}

export const RulerOverlay: React.FC<RulerOverlayProps> = ({
  isActive,
  onClose,
  transform,
  rulerState,
  onRulerChange,
  isDarkMode,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number } | null>(null);
  const rotateStartRef = useRef<{ clientX: number; clientY: number; initialAngle: number; centerX: number; centerY: number } | null>(null);

  if (!isActive) return null;

  // Convert page coordinates to screen pixels
  const screenX = rulerState.x * transform.zoom + transform.panX;
  const screenY = rulerState.y * transform.zoom + transform.panY;
  const screenLength = rulerState.length * transform.zoom;
  const rulerHeight = 64 * transform.zoom;

  // Dragging movement
  const handleDragPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: rulerState.x,
      initialY: rulerState.y,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = (ev.clientX - dragStartRef.current.clientX) / transform.zoom;
      const dy = (ev.clientY - dragStartRef.current.clientY) / transform.zoom;
      onRulerChange({
        ...rulerState,
        x: dragStartRef.current.initialX + dx,
        y: dragStartRef.current.initialY + dy,
      });
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

  // Rotation movement
  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsRotating(true);

    const centerX = screenX;
    const centerY = screenY;

    rotateStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialAngle: rulerState.angle,
      centerX,
      centerY,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!rotateStartRef.current) return;
      const dx = ev.clientX - rotateStartRef.current.centerX;
      const dy = ev.clientY - rotateStartRef.current.centerY;
      let angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      if (angleDeg < 0) angleDeg += 360;

      // Snap to standard 0, 15, 30, 45, 60, 90 angles if within 3 degrees
      const snapAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360];
      for (const snap of snapAngles) {
        if (Math.abs(angleDeg - snap) <= 3) {
          angleDeg = snap % 360;
          break;
        }
      }

      onRulerChange({
        ...rulerState,
        angle: angleDeg,
      });
    };

    const handlePointerUp = () => {
      setIsRotating(false);
      rotateStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Generate tick marks (every 10pt is 1 unit, every 50pt is numbered)
  const numTicks = Math.floor(rulerState.length / 10);
  const ticks = [];
  for (let i = 0; i <= numTicks; i++) {
    const isMajor = i % 5 === 0;
    const isNumbered = i % 10 === 0;
    ticks.push({
      index: i,
      x: i * 10 * transform.zoom,
      height: isNumbered ? 18 * transform.zoom : isMajor ? 12 * transform.zoom : 7 * transform.zoom,
      label: isNumbered ? `${i / 10}` : undefined,
    });
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenLength}px`,
        height: `${rulerHeight}px`,
        transformOrigin: '0% 0%',
        transform: `rotate(${rulerState.angle}deg)`,
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.88)' : 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1.5px solid var(--accent-primary, #3f52ff)',
        borderRadius: '6px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.22)',
        zIndex: 30,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Top Edge Tick Scale */}
      <div style={{ position: 'relative', width: '100%', height: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
        {ticks.map((t) => (
          <React.Fragment key={t.index}>
            <div
              style={{
                position: 'absolute',
                left: `${t.x}px`,
                top: 0,
                width: '1px',
                height: `${t.height}px`,
                backgroundColor: 'var(--text-secondary, #64748b)',
              }}
            />
            {t.label && (
              <span
                style={{
                  position: 'absolute',
                  left: `${t.x + 2}px`,
                  top: `${t.height + 2}px`,
                  fontSize: `${Math.max(9, Math.round(10 * transform.zoom))}px`,
                  fontWeight: 700,
                  color: 'var(--text-secondary, #64748b)',
                  lineHeight: 1,
                }}
              >
                {t.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Center Controls & Angle Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          height: 'calc(100% - 24px)',
        }}
      >
        {/* Drag Movement Handle */}
        <div
          onPointerDown={handleDragPointerDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: isDragging ? 'grabbing' : 'grab',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(63, 82, 255, 0.12)',
            color: '#3f52ff',
            fontSize: '11px',
            fontWeight: 700,
          }}
          title="Drag to move ruler"
        >
          <Move size={14} />
          <span>Move</span>
        </div>

        {/* Current Angle Readout */}
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {rulerState.angle}°
        </div>

        {/* Right Action: Rotation Handle & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onPointerDown={handleRotatePointerDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: isRotating ? 'grabbing' : 'grab',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(63, 82, 255, 0.12)',
              color: '#3f52ff',
              fontSize: '11px',
              fontWeight: 700,
            }}
            title="Drag to rotate ruler angle"
          >
            <RotateCw size={13} />
            <span>Rotate</span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Dismiss Ruler"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
