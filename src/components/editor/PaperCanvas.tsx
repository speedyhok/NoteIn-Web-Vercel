import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Page, Stroke, TextBox, ToolType, ViewportTransform, Point } from '../../types';
import { screenToPage, clampZoom } from '../../engine/transform';
import { calculateBoundingBox } from '../../engine/spline';
import { renderPaperBackground } from '../../engine/paper';
import { renderStrokes, renderStroke } from '../../engine/renderer';
import { isStrokeIntersectedByEraser } from '../../engine/eraser';
import { TextBoxOverlay } from './TextBoxOverlay';
import { RulerOverlay, type RulerState } from './RulerOverlay';
import { NoteinHand } from '../icons/NoteinIcons';

export type ShapeMode = 'none' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'auto';

interface PaperCanvasProps {
  page: Page;
  strokes: Stroke[];
  textBoxes: TextBox[];
  activeTool: ToolType;
  currentColor: string;
  currentWidth: number;
  transform: ViewportTransform;
  onTransformChange: (transform: ViewportTransform) => void;
  onAddStroke: (stroke: Stroke) => void;
  onStrokesLiveUpdate: (strokes: Stroke[]) => void;
  onDeleteStrokesCommit: (deletedStrokes: Stroke[]) => void;
  // Text box handlers
  onCreateTextBox: (x: number, y: number) => void;
  selectedTextBoxId: string | null;
  editingTextBoxId: string | null;
  onSelectTextBox: (id: string | null) => void;
  onStartEditingTextBox: (id: string) => void;
  onEndEditingTextBox: (id: string, newContent: string) => void;
  onUpdateTextBoxPosition: (id: string, newX: number, newY: number) => void;
  onCommitTextBoxPosition: (id: string, oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateTextBoxSize: (id: string, newW: number, newH: number) => void;
  onCommitTextBoxSize: (id: string, oldW: number, oldH: number, newW: number, newH: number) => void;
  onDeleteTextBox: (id: string) => void;
  onDuplicateTextBox?: (id: string) => void;
  onUpdateTextBoxStyle?: (id: string, updates: Partial<TextBox>) => void;
  eraseHighlighterOnly?: boolean;
  onSelectTool?: (tool: ToolType) => void;
  isDarkMode: boolean;
  shapeMode?: ShapeMode;
  isRulerActive?: boolean;
  onCloseRuler?: () => void;
}

// Geometric vector shape point generator
function generateShapePoints(mode: ShapeMode, rawPoints: Point[]): Point[] {
  if (rawPoints.length < 2) return rawPoints;
  const start = rawPoints[0];
  const end = rawPoints[rawPoints.length - 1];

  let resolvedMode = mode;
  if (mode === 'auto') {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);

    let totalLength = 0;
    for (let i = 1; i < rawPoints.length; i++) {
      totalLength += Math.hypot(rawPoints[i].x - rawPoints[i - 1].x, rawPoints[i].y - rawPoints[i - 1].y);
    }

    if (dist < totalLength * 0.35 && totalLength > 60) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of rawPoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const w = maxX - minX;
      const h = maxY - minY;
      const ratio = Math.min(w, h) / Math.max(w, h);
      resolvedMode = ratio > 0.65 ? 'circle' : 'rect';
    } else if (dist > 30) {
      resolvedMode = 'line';
    } else {
      return rawPoints;
    }
  }

  if (resolvedMode === 'line') {
    const points: Point[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        pressure: 0.6,
        time: Date.now() + i,
      });
    }
    return points;
  }

  if (resolvedMode === 'rect') {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      { x: minX, y: minY },
    ];
    const points: Point[] = [];
    const steps = 10;
    for (let c = 0; c < 4; c++) {
      const p1 = corners[c];
      const p2 = corners[c + 1];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        points.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          pressure: 0.6,
          time: Date.now() + c * steps + s,
        });
      }
    }
    points.push({ x: minX, y: minY, pressure: 0.6, time: Date.now() + 50 });
    return points;
  }

  if (resolvedMode === 'circle') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.max(1, Math.abs(end.x - start.x) / 2);
    const ry = Math.max(1, Math.abs(end.y - start.y) / 2);

    const points: Point[] = [];
    const numPoints = 48;
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      points.push({
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        pressure: 0.6,
        time: Date.now() + i,
      });
    }
    return points;
  }

  if (resolvedMode === 'triangle') {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const top = { x: (start.x + end.x) / 2, y: minY };
    const right = { x: maxX, y: maxY };
    const left = { x: minX, y: maxY };
    const vertices = [top, right, left, top];
    const points: Point[] = [];
    const steps = 10;
    for (let v = 0; v < 3; v++) {
      const p1 = vertices[v];
      const p2 = vertices[v + 1];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        points.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          pressure: 0.6,
          time: Date.now() + v * steps + s,
        });
      }
    }
    points.push({ x: top.x, y: top.y, pressure: 0.6, time: Date.now() + 40 });
    return points;
  }

  if (resolvedMode === 'arrow') {
    const points: Point[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        pressure: 0.6,
        time: Date.now() + i,
      });
    }
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const arrowLen = Math.min(24, Math.max(10, dist * 0.25));
    const wing1 = {
      x: end.x - arrowLen * Math.cos(angle - Math.PI / 6),
      y: end.y - arrowLen * Math.sin(angle - Math.PI / 6),
    };
    const wing2 = {
      x: end.x - arrowLen * Math.cos(angle + Math.PI / 6),
      y: end.y - arrowLen * Math.sin(angle + Math.PI / 6),
    };
    points.push({ x: wing1.x, y: wing1.y, pressure: 0.6, time: Date.now() + 25 });
    points.push({ x: end.x, y: end.y, pressure: 0.6, time: Date.now() + 26 });
    points.push({ x: wing2.x, y: wing2.y, pressure: 0.6, time: Date.now() + 27 });
    return points;
  }

  return rawPoints;
}

// Snap drawn points to ruler top straight edge
function snapPointsToRuler(points: Point[], ruler: RulerState): Point[] {
  if (points.length < 2) return points;
  const rad = (ruler.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const snapped: Point[] = [];
  let nearRulerCount = 0;

  for (const pt of points) {
    const dx = pt.x - ruler.x;
    const dy = pt.y - ruler.y;
    // Project along ruler vector and perpendicular
    const projAlong = dx * cos + dy * sin;
    const projPerp = -dx * sin + dy * cos;

    // If within 35pt of top ruler edge (projPerp near 0 and along length)
    if (Math.abs(projPerp) < 35 && projAlong >= -10 && projAlong <= ruler.length + 10) {
      nearRulerCount++;
      snapped.push({
        x: ruler.x + projAlong * cos,
        y: ruler.y + projAlong * sin,
        pressure: pt.pressure,
        time: pt.time,
      });
    } else {
      snapped.push(pt);
    }
  }

  return nearRulerCount > points.length * 0.4 ? snapped : points;
}

export const PaperCanvas: React.FC<PaperCanvasProps> = ({
  page,
  strokes,
  textBoxes,
  activeTool,
  currentColor,
  currentWidth,
  transform,
  onTransformChange,
  onAddStroke,
  onStrokesLiveUpdate,
  onDeleteStrokesCommit,
  onCreateTextBox,
  selectedTextBoxId,
  editingTextBoxId,
  onSelectTextBox,
  onStartEditingTextBox,
  onEndEditingTextBox,
  onUpdateTextBoxPosition,
  onCommitTextBoxPosition,
  onUpdateTextBoxSize,
  onCommitTextBoxSize,
  onDeleteTextBox,
  onDuplicateTextBox,
  onUpdateTextBoxStyle,
  eraseHighlighterOnly = false,
  onSelectTool,
  isDarkMode,
  shapeMode = 'none',
  isRulerActive = false,
  onCloseRuler,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const activePointsRef = useRef<Point[]>([]);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);

  // Ruler state
  const [rulerState, setRulerState] = useState<RulerState>({
    x: 100,
    y: 160,
    angle: 0,
    length: 460,
  });

  // Group erased strokes across a single continuous gesture
  const erasedInGestureRef = useRef<Map<string, Stroke>>(new Map());
  // Keep track of current strokes for eraser collision without stale closures
  const currentStrokesRef = useRef<Stroke[]>(strokes);
  useEffect(() => {
    currentStrokesRef.current = strokes;
  }, [strokes]);

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

    if (page.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, page.width, page.height);
      };
      img.src = page.backgroundImage;
    }
  }, [page.width, page.height, page.template, isDarkMode, page.backgroundImage]);

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
      let previewPoints = activePointsRef.current;

      if (shapeMode !== 'none' && previewPoints.length > 1) {
        const start = previewPoints[0];
        const end = previewPoints[previewPoints.length - 1];
        if (Math.hypot(end.x - start.x, end.y - start.y) >= 2 || shapeMode === 'auto') {
          previewPoints = generateShapePoints(shapeMode, previewPoints);
        }
      } else if (isRulerActive && previewPoints.length > 1) {
        previewPoints = snapPointsToRuler(previewPoints, rulerState);
      }

      const activeStroke: Stroke = {
        id: 'active_preview',
        pageId: page.id,
        toolType: activeTool,
        color: currentColor,
        width: currentWidth,
        opacity: activeTool === 'highlighter' ? 0.4 : 1.0,
        points: previewPoints,
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        createdAt: Date.now(),
      };
      renderStroke(ctx, activeStroke);
    }
  }, [page.width, page.height, page.id, activeTool, currentColor, currentWidth, shapeMode, isRulerActive, rulerState]);

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

  // Eraser Collision Check
  const checkEraserCollision = (pt: Point) => {
    const eraserRadius = currentWidth * 1.5;
    const currentList = currentStrokesRef.current;
    const hitList = currentList.filter((s) => {
      if (eraseHighlighterOnly && s.toolType !== 'highlighter') {
        return false;
      }
      return isStrokeIntersectedByEraser(pt, eraserRadius, s);
    });

    if (hitList.length > 0) {
      hitList.forEach((s) => erasedInGestureRef.current.set(s.id, s));
      const hitIds = new Set(hitList.map((s) => s.id));
      const remaining = currentList.filter((s) => !hitIds.has(s.id));
      currentStrokesRef.current = remaining;
      onStrokesLiveUpdate(remaining);
    }
  };

  // Pointer Down Event
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    if (activeTool !== 'text' && selectedTextBoxId) {
      onSelectTextBox(null);
    }

    if (activeTool === 'pan' || (e.pointerType === 'touch' && e.altKey)) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      setIsPanning(true);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    if (activeTool === 'text') {
      // 1. Check if clicking inside an existing text box on the page
      const clickedExisting = textBoxes.find(
        (tb) =>
          pagePt.x >= tb.x - 4 &&
          pagePt.x <= tb.x + tb.width + 4 &&
          pagePt.y >= tb.y - 4 &&
          pagePt.y <= tb.y + tb.height + 4
      );

      if (clickedExisting) {
        onSelectTextBox(clickedExisting.id);
        return;
      }

      // 2. If clicking inside the paper page, create a new text box at the clicked point
      if (pagePt.x >= 0 && pagePt.x <= page.width && pagePt.y >= 0 && pagePt.y <= page.height) {
        onCreateTextBox(Math.round(pagePt.x), Math.round(pagePt.y));
      } else if (selectedTextBoxId || editingTextBoxId) {
        // Clicking outside the paper boundary deselects
        onSelectTextBox(null);
      }
      return;
    }

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}

    const newPt: Point = {
      x: pagePt.x,
      y: pagePt.y,
      pressure: e.pressure || 0.5,
      time: Date.now(),
    };

    if (activeTool === 'eraser') {
      setIsDrawing(true);
      erasedInGestureRef.current = new Map();
      checkEraserCollision(newPt);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      activePointsRef.current = [newPt];
      redrawActiveCanvas();
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
      if (shapeMode !== 'none' && shapeMode !== 'auto') {
        // For geometric shapes (rect, circle, triangle, line, arrow),
        // anchor at start point and update current end point so the shape live-resizes bigger/smaller!
        const startPt = activePointsRef.current[0] || newPt;
        activePointsRef.current = [startPt, newPt];
      } else {
        activePointsRef.current.push(newPt);
      }
      redrawActiveCanvas();
    }
  };

  // Pointer Up Event
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (isPanning) {
      setIsPanning(false);
      lastPanPointRef.current = null;
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'eraser') {
      if (erasedInGestureRef.current.size > 0) {
        const deletedStrokes = Array.from(erasedInGestureRef.current.values());
        erasedInGestureRef.current = new Map();
        onDeleteStrokesCommit(deletedStrokes);
      }
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      let points = activePointsRef.current;
      activePointsRef.current = [];
      redrawActiveCanvas();

      if (points.length > 0) {
        // Apply geometric shape recognition if active
        if (shapeMode !== 'none' && points.length > 1) {
          const start = points[0];
          const end = points[points.length - 1];
          if (Math.hypot(end.x - start.x, end.y - start.y) >= 3 || shapeMode === 'auto') {
            points = generateShapePoints(shapeMode, points);
          }
        } else if (isRulerActive && points.length > 1) {
          points = snapPointsToRuler(points, rulerState);
        }

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
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = clampZoom(transform.zoom * zoomFactor);

      const newPanX = mouseX - (mouseX - transform.panX) * (newZoom / transform.zoom);
      const newPanY = mouseY - (mouseY - transform.panY) * (newZoom / transform.zoom);

      onTransformChange({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    } else {
      onTransformChange({
        ...transform,
        panX: transform.panX - e.deltaX,
        panY: transform.panY - e.deltaY,
      });
    }
  };

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'eraser') return 'crosshair';
    if (activeTool === 'text') return 'text';
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: getCursor(),
        touchAction: 'none',
        backgroundColor: 'var(--canvas-bg)',
      }}
    >
      {/* Scaled Page Container */}
      <div
        style={{
          position: 'absolute',
          left: `${transform.panX}px`,
          top: `${transform.panY}px`,
          width: `${page.width}px`,
          height: `${page.height}px`,
          transform: `scale(${transform.zoom})`,
          transformOrigin: '0 0',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16)',
        }}
      >
        {/* Layer 1: Paper Background */}
        <canvas
          ref={paperCanvasRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2: Completed Vector Strokes */}
        <canvas
          ref={strokesCanvasRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 3: Active In-Progress Stroke Preview */}
        <canvas
          ref={activeCanvasRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 4: Interactive Text Boxes */}
        <TextBoxOverlay
          textBoxes={textBoxes}
          selectedTextBoxId={selectedTextBoxId}
          editingTextBoxId={editingTextBoxId}
          onSelectTextBox={onSelectTextBox}
          onStartEditingTextBox={onStartEditingTextBox}
          onEndEditingTextBox={onEndEditingTextBox}
          onUpdatePosition={onUpdateTextBoxPosition}
          onCommitPosition={onCommitTextBoxPosition}
          onUpdateSize={onUpdateTextBoxSize}
          onCommitSize={onCommitTextBoxSize}
          onDeleteTextBox={onDeleteTextBox}
          onDuplicateTextBox={onDuplicateTextBox}
          onUpdateTextBoxStyle={onUpdateTextBoxStyle}
          zoom={transform.zoom}
        />
      </div>

      {/* Interactive Translucent Ruler Overlay */}
      {isRulerActive && (
        <RulerOverlay
          isActive={isRulerActive}
          onClose={() => {
            if (onCloseRuler) onCloseRuler();
          }}
          transform={transform}
          rulerState={rulerState}
          onRulerChange={setRulerState}
          isDarkMode={isDarkMode}
        />
      )}
      {/* Dedicated Hand / Move Screen Badge */}
      {activeTool === 'pan' && (
        <div
          className="animate-slide-up"
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '9999px',
            padding: '8px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            pointerEvents: 'auto',
          }}
        >
          <NoteinHand size={18} color="#3f52ff" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Hand Tool: Drag anywhere to move screen
          </span>
          {onSelectTool && (
            <button
              onClick={() => onSelectTool('pen')}
              style={{
                marginLeft: '4px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#3f52ff',
                color: '#ffffff',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done Moving
            </button>
          )}
        </div>
      )}
    </div>
  );
};
