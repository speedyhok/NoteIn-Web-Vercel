import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Page, Stroke, TextBox, NoteImage, ToolType, ViewportTransform, Point } from '../../types';
import { screenToPage, clampZoom } from '../../engine/transform';
import { calculateBoundingBox } from '../../engine/spline';
import { renderPaperBackground } from '../../engine/paper';
import { renderStrokes, renderStroke } from '../../engine/renderer';
import { isStrokeIntersectedByEraser } from '../../engine/eraser';
import { TextBoxOverlay } from './TextBoxOverlay';
import { ImageOverlay } from './ImageOverlay';
import { RulerOverlay, type RulerState } from './RulerOverlay';
import { GripVertical, Trash2, Copy, X } from 'lucide-react';

export type ShapeMode = 'none' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'auto';

interface PaperCanvasProps {
  page: Page;
  strokes: Stroke[];
  textBoxes: TextBox[];
  images?: NoteImage[];
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
  onUpdateImagePosition?: (id: string, newX: number, newY: number) => void;
  onCommitImagePosition?: (id: string, oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateImageSize?: (id: string, newW: number, newH: number) => void;
  onCommitImageSize?: (id: string, oldW: number, oldH: number, newW: number, newH: number) => void;
  onDeleteImage?: (id: string) => void;
  onDuplicateImage?: (id: string) => void;
  onCommitStrokesUpdate?: (updatedStrokes: Stroke[], prevStrokes?: Stroke[]) => void;
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
  isReadOnly?: boolean;
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


// Check if point is inside polygon (Ray-casting)
function isPointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to line segment
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Check if a stroke is near a point (hit testing)
function isStrokeNearPoint(stroke: Stroke, px: number, py: number, threshold = 16): boolean {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;
  if (pts.length === 1) {
    return Math.hypot(pts[0].x - px, pts[0].y - py) <= threshold;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= threshold) {
      return true;
    }
  }
  return false;
}

// Check if stroke is enclosed by or intersects lasso polygon
function isStrokeInLasso(stroke: Stroke, polygon: { x: number; y: number }[]): boolean {
  if (!stroke.points || stroke.points.length === 0) return false;
  for (const pt of stroke.points) {
    if (isPointInPolygon(pt.x, pt.y, polygon)) return true;
  }
  return false;
}

export const PaperCanvas: React.FC<PaperCanvasProps> = ({
  page,
  strokes,
  textBoxes,
  images = [],
  selectedImageId,
  onSelectImage,
  onUpdateImagePosition,
  onCommitImagePosition,
  onUpdateImageSize,
  onCommitImageSize,
  onDeleteImage,
  onDuplicateImage,
  onCommitStrokesUpdate,
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
  onSelectTool: _onSelectTool,
  isDarkMode,
  shapeMode = 'none',
  isRulerActive = false,
  onCloseRuler,
  isReadOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Lasso & Stroke / Shape selection state
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const isDrawingLassoRef = useRef(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const selectionDragStartRef = useRef<{
    startPt: { x: number; y: number };
    initialStrokes: Stroke[];
    lastDx: number;
    lastDy: number;
    hasMoved: boolean;
  } | null>(null);

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

  // Clear selected stroke IDs if switching away from lasso
  useEffect(() => {
    if (activeTool !== 'lasso') {
      setSelectedStrokeIds([]);
    }
  }, [activeTool]);

  // Lasso Selection Dragging Handlers
  const handleSelectionPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id));
    setIsDraggingSelection(true);
    selectionDragStartRef.current = {
      startPt: pagePt,
      initialStrokes: selectedStrokes.map((s) => ({
        ...s,
        points: s.points.map((p) => ({ ...p })),
      })),
      lastDx: 0,
      lastDy: 0,
      hasMoved: false,
    };
  };

  const handleSelectionPointerMove = (e: React.PointerEvent) => {
    if (!selectionDragStartRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    const dx = pagePt.x - selectionDragStartRef.current.startPt.x;
    const dy = pagePt.y - selectionDragStartRef.current.startPt.y;

    if (!selectionDragStartRef.current.hasMoved && Math.hypot(dx, dy) > 2) {
      selectionDragStartRef.current.hasMoved = true;
    }

    if (selectionDragStartRef.current.hasMoved) {
      selectionDragStartRef.current.lastDx = dx;
      selectionDragStartRef.current.lastDy = dy;
      const updatedSelected = selectionDragStartRef.current.initialStrokes.map((s) => ({
        ...s,
        points: s.points.map((p) => ({
          ...p,
          x: Math.round(p.x + dx),
          y: Math.round(p.y + dy),
        })),
      }));
      const updateMap = new Map(updatedSelected.map((s) => [s.id, s]));
      const nextAll = strokes.map((s) => updateMap.get(s.id) || s);
      onStrokesLiveUpdate(nextAll);
    }
  };

  const handleSelectionPointerUp = (e: React.PointerEvent) => {
    if (!selectionDragStartRef.current) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { hasMoved, lastDx, lastDy, initialStrokes } = selectionDragStartRef.current;
    selectionDragStartRef.current = null;
    setIsDraggingSelection(false);

    if (hasMoved && onCommitStrokesUpdate) {
      const finalSelected = initialStrokes.map((s) => ({
        ...s,
        points: s.points.map((p) => ({
          ...p,
          x: Math.round(p.x + lastDx),
          y: Math.round(p.y + lastDy),
        })),
      }));
      onCommitStrokesUpdate(finalSelected, initialStrokes);
    }
  };

  const handleDuplicateSelection = () => {
    const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id));
    if (selectedStrokes.length === 0) return;
    const duplicated = selectedStrokes.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      points: s.points.map((p) => ({ ...p, x: Math.round(p.x + 24), y: Math.round(p.y + 24) })),
      createdAt: Date.now(),
    }));
    for (const d of duplicated) {
      onAddStroke(d);
    }
    setSelectedStrokeIds(duplicated.map((d) => d.id));
  };

  const handleDeleteSelection = () => {
    const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id));
    if (selectedStrokes.length === 0) return;
    onDeleteStrokesCommit(selectedStrokes);
    setSelectedStrokeIds([]);
  };

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

    if (isReadOnly) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      setIsPanning(true);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);

    if (activeTool !== 'text' && activeTool !== 'lasso' && selectedTextBoxId) {
      onSelectTextBox(null);
    }
    if (activeTool !== 'lasso' && selectedImageId && onSelectImage) {
      onSelectImage(null);
    }

    if (activeTool === 'pan' || (e.pointerType === 'touch' && e.altKey)) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      setIsPanning(true);
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (activeTool === 'lasso') {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      isDrawingLassoRef.current = true;
      lassoPointsRef.current = [pagePt];
      return;
    }

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

    if (activeTool === 'lasso') {
      if (isDrawingLassoRef.current) {
        lassoPointsRef.current.push(pagePt);
        const canvas = activeCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, page.width, page.height);
            ctx.save();
            ctx.strokeStyle = '#3f52ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.fillStyle = 'rgba(63, 82, 255, 0.08)';
            ctx.beginPath();
            const pts = lassoPointsRef.current;
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.stroke();
            ctx.fill();
            ctx.restore();
          }
        }
      }
      return;
    }

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

    if (activeTool === 'lasso') {
      if (isDrawingLassoRef.current) {
        isDrawingLassoRef.current = false;
        const canvas = activeCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, page.width, page.height);
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const pagePt = screenToPage(e.clientX, e.clientY, rect, transform);
        const pts = lassoPointsRef.current;
        let totalDist = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          totalDist += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        }

        if (totalDist > 20 && pts.length > 3) {
          // Enclosed strokes
          const enclosed = strokes.filter((s) => isStrokeInLasso(s, pts));
          if (enclosed.length > 0) {
            setSelectedStrokeIds(enclosed.map((s) => s.id));
          } else {
            // Check if lasso enclosed a text box or image
            const enclosedBox = textBoxes.find((tb) =>
              isPointInPolygon(tb.x + tb.width / 2, tb.y + tb.height / 2, pts)
            );
            if (enclosedBox) {
              onSelectTextBox(enclosedBox.id);
            }
            const enclosedImg = images?.find((img) =>
              isPointInPolygon(img.x + img.width / 2, img.y + img.height / 2, pts)
            );
            if (enclosedImg && onSelectImage) {
              onSelectImage(enclosedImg.id);
            }
            setSelectedStrokeIds([]);
          }
        } else {
          // Tap / Click detection: hit test closest stroke/shape
          const tapped = [...strokes].reverse().find((s) => isStrokeNearPoint(s, pagePt.x, pagePt.y, 16));
          if (tapped) {
            setSelectedStrokeIds([tapped.id]);
          } else {
            // Check if clicked a text box
            const clickedBox = textBoxes.find(
              (tb) =>
                pagePt.x >= tb.x &&
                pagePt.x <= tb.x + tb.width &&
                pagePt.y >= tb.y &&
                pagePt.y <= tb.y + tb.height
            );
            if (clickedBox) {
              onSelectTextBox(clickedBox.id);
            } else {
              // Check if clicked an image
              const clickedImg = images?.find(
                (img) =>
                  pagePt.x >= img.x &&
                  pagePt.x <= img.x + img.width &&
                  pagePt.y >= img.y &&
                  pagePt.y <= img.y + img.height
              );
              if (clickedImg && onSelectImage) {
                onSelectImage(clickedImg.id);
              } else {
                setSelectedStrokeIds([]);
                onSelectTextBox(null);
                if (onSelectImage) onSelectImage(null);
              }
            }
          }
        }
      }
      return;
    }

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

  // Selected Strokes Bounding Box
  const selectedStrokes = strokes.filter((s) => selectedStrokeIds.includes(s.id));
  let selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (selectedStrokes.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stroke of selectedStrokes) {
      for (const pt of stroke.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    if (minX !== Infinity && maxX !== -Infinity) {
      selectionBounds = { minX, minY, maxX, maxY };
    }
  }

  const getCursor = () => {
    if (isReadOnly) return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'lasso') return isDraggingSelection ? 'grabbing' : 'crosshair';
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

        {/* Layer 1.5: Interactive Embedded Page Images */}
        {images && images.length > 0 && (
          <ImageOverlay
            images={images}
            selectedImageId={isReadOnly ? null : (selectedImageId || null)}
            onSelectImage={isReadOnly ? () => {} : (onSelectImage || (() => {}))}
            onUpdatePosition={onUpdateImagePosition || (() => {})}
            onCommitPosition={onCommitImagePosition || (() => {})}
            onUpdateSize={onUpdateImageSize || (() => {})}
            onCommitSize={onCommitImageSize || (() => {})}
            onDeleteImage={onDeleteImage || (() => {})}
            onDuplicateImage={onDuplicateImage}
            zoom={transform.zoom}
            activeTool={isReadOnly ? 'pen' : activeTool}
          />
        )}

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

        {/* Layer 5: Lasso Selection Bounding Box & Floating Action Menu */}
        {!isReadOnly && selectionBounds && selectedStrokes.length > 0 && (
          <div
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={handleSelectionPointerUp}
            onPointerCancel={handleSelectionPointerUp}
            style={{
              position: 'absolute',
              left: `${selectionBounds.minX - 8}px`,
              top: `${selectionBounds.minY - 8}px`,
              width: `${selectionBounds.maxX - selectionBounds.minX + 16}px`,
              height: `${selectionBounds.maxY - selectionBounds.minY + 16}px`,
              border: '2px dashed #3f52ff',
              borderRadius: '6px',
              backgroundColor: isDraggingSelection
                ? 'rgba(63, 82, 255, 0.12)'
                : 'rgba(63, 82, 255, 0.05)',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.8), 0 4px 16px rgba(63, 82, 255, 0.25)',
              cursor: isDraggingSelection ? 'grabbing' : 'grab',
              pointerEvents: 'auto',
              zIndex: 25,
            }}
          >
            {/* Floating Action Menu for Selected Shapes/Strokes */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
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
                userSelect: 'none',
                pointerEvents: 'auto',
                zIndex: 30,
              }}
            >
              <div
                onPointerDown={handleSelectionPointerDown}
                onPointerMove={handleSelectionPointerMove}
                onPointerUp={handleSelectionPointerUp}
                onPointerCancel={handleSelectionPointerUp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#3f52ff',
                  fontSize: '11px',
                  fontWeight: 700,
                  paddingRight: '4px',
                  cursor: isDraggingSelection ? 'grabbing' : 'grab',
                }}
              >
                <GripVertical size={13} />
                <span>Move Shape</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateSelection();
                }}
                title="Duplicate Shape"
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSelection();
                }}
                title="Delete Shape"
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStrokeIds([]);
                }}
                title="Deselect"
                style={{
                  padding: '3px 5px',
                  borderRadius: '4px',
                  color: 'var(--text-muted)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
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

    </div>
  );
};
