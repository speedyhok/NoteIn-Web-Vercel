import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Page, Stroke, ToolType, ViewportTransform, Point } from '../../types';
import { screenToPage, clampZoom } from '../../engine/transform';
import { calculateBoundingBox } from '../../engine/spline';
import { renderPaperBackground } from '../../engine/paper';
import { renderStrokes, renderStroke } from '../../engine/renderer';
import { isStrokeIntersectedByEraser } from '../../engine/eraser';

interface PaperCanvasProps {
  page: Page;
  strokes: Stroke[];
  activeTool: ToolType;
  currentColor: string;
  currentWidth: number;
  transform: ViewportTransform;
  onTransformChange: (transform: ViewportTransform) => void;
  onAddStroke: (stroke: Stroke) => void;
  onDeleteStrokes: (strokes: Stroke[]) => void;
  isDarkMode: boolean;
}

export const PaperCanvas: React.FC<PaperCanvasProps> = ({
  page,
  strokes,
  activeTool,
  currentColor,
  currentWidth,
  transform,
  onTransformChange,
  onAddStroke,
  onDeleteStrokes,
  isDarkMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const activePointsRef = useRef<Point[]>([]);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);

  // Render Paper Background
  useEffect(() => {
    const canvas = paperCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (!ctx) return;

    canvas.width = page.width * dpr;
    canvas.height = page.height * dpr;
    ctx.scale(dpr, dpr);

    renderPaperBackground(ctx, page.width, page.height, page.template, isDarkMode);
  }, [page.width, page.height, page.template, isDarkMode]);

  // Render Completed Vector Strokes
  useEffect(() => {
    const canvas = strokesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (!ctx) return;

    canvas.width = page.width * dpr;
    canvas.height = page.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, page.width, page.height);
    renderStrokes(ctx, strokes);
  }, [page.width, page.height, strokes]);

  // Redraw Active Stroke Preview on Top Canvas
  const redrawActiveCanvas = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, page.width, page.height);

    if (activePointsRef.current.length > 0 && (activeTool === 'pen' || activeTool === 'highlighter')) {
      const activeStroke: Stroke = {
        id: 'active_preview',
        pageId: page.id,
        toolType: activeTool,
        color: currentColor,
        width: currentWidth,
        opacity: activeTool === 'highlighter' ? 0.4 : 1.0,
        points: activePointsRef.current,
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        createdAt: Date.now(),
      };
      renderStroke(ctx, activeStroke);
    }
  }, [page.width, page.height, page.id, activeTool, currentColor, currentWidth]);

  // Setup Active Canvas Resizing
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = page.width * dpr;
    canvas.height = page.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [page.width, page.height]);

  // Pointer Down Event
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary mouse button or touch/pen
    if (e.button !== 0) return;

    // Capture pointer
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'pan' || e.pointerType === 'touch' && e.altKey) {
      setIsPanning(true);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    // Clamp pointer within or slightly near page
    const newPt: Point = {
      x: pagePt.x,
      y: pagePt.y,
      pressure: e.pressure || 0.5,
      time: Date.now(),
    };

    if (activeTool === 'eraser') {
      setIsDrawing(true);
      checkEraserCollision(newPt);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      activePointsRef.current = [newPt];
      redrawActiveCanvas();
    }
  };

  // Eraser Collision Check
  const checkEraserCollision = (pt: Point) => {
    const eraserRadius = currentWidth * 1.5;
    const hitStrokes = strokes.filter((s) =>
      isStrokeIntersectedByEraser(pt, eraserRadius, s)
    );

    if (hitStrokes.length > 0) {
      onDeleteStrokes(hitStrokes);
    }
  };

  // Pointer Move Event
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };

      onTransformChange({
        ...transform,
        panX: transform.panX + dx,
        panY: transform.panY + dy,
      });
      return;
    }

    if (!isDrawing) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    const newPt: Point = {
      x: pagePt.x,
      y: pagePt.y,
      pressure: e.pressure || 0.5,
      time: Date.now(),
    };

    if (activeTool === 'eraser') {
      checkEraserCollision(newPt);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      activePointsRef.current.push(newPt);
      redrawActiveCanvas();
    }
  };

  // Pointer Up Event
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if capture already lost
    }

    if (isPanning) {
      setIsPanning(false);
      lastPanPointRef.current = null;
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      const points = activePointsRef.current;
      activePointsRef.current = [];
      redrawActiveCanvas();

      if (points.length > 0) {
        const bounds = calculateBoundingBox(points, currentWidth);
        const newStroke: Stroke = {
          id: crypto.randomUUID(),
          pageId: page.id,
          toolType: activeTool,
          color: currentColor,
          width: currentWidth,
          opacity: activeTool === 'highlighter' ? 0.4 : 1.0,
          points,
          bounds,
          createdAt: Date.now(),
        };
        onAddStroke(newStroke);
      }
    }
  };

  // Wheel Event (Pinch to zoom and two-finger scroll)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch to Zoom
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = clampZoom(transform.zoom * zoomFactor);

      // Zoom towards mouse position
      const newPanX = mouseX - (mouseX - transform.panX) * (newZoom / transform.zoom);
      const newPanY = mouseY - (mouseY - transform.panY) * (newZoom / transform.zoom);

      onTransformChange({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    } else {
      // Two-finger Pan
      onTransformChange({
        ...transform,
        panX: transform.panX - e.deltaX,
        panY: transform.panY - e.deltaY,
      });
    }
  };

  // Cursor style based on active tool
  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'eraser') return 'crosshair';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-canvas-outer)',
        cursor: getCursor(),
        touchAction: 'none',
      }}
    >
      {/* Transformed Page Surface */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${page.width}px`,
          height: `${page.height}px`,
          transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
          transformOrigin: '0 0',
          boxShadow: 'var(--paper-shadow)',
          borderRadius: '4px',
          willChange: 'transform',
        }}
      >
        {/* Layer 1: Paper Background Canvas */}
        <canvas
          ref={paperCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: `${page.width}px`,
            height: `${page.height}px`,
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2: Completed Vector Strokes Canvas */}
        <canvas
          ref={strokesCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: `${page.width}px`,
            height: `${page.height}px`,
            pointerEvents: 'none',
          }}
        />

        {/* Layer 3: Active In-Flight Stroke Preview Canvas */}
        <canvas
          ref={activeCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: `${page.width}px`,
            height: `${page.height}px`,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};
