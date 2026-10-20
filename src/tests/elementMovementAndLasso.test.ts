import { describe, it, expect } from 'vitest';
import type { NoteImage, Stroke } from '../types';
import { HistoryManager } from '../engine/history';

// Helper geometric functions for lasso selection
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

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function isStrokeNearPoint(stroke: Stroke, px: number, py: number, threshold = 16): boolean {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= threshold) {
      return true;
    }
  }
  return false;
}

describe('Element Movement: Images, Shapes and Lasso Operations', () => {
  const sampleImage: NoteImage = {
    id: 'img-1',
    pageId: 'page-1',
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    x: 50,
    y: 80,
    width: 200,
    height: 150,
    rotation: 0,
    opacity: 1,
    createdAt: 1000,
  };

  it('updates and commits image positions correctly', () => {
    let images: NoteImage[] = [sampleImage];

    // Live update position during dragging
    images = images.map((img) => (img.id === 'img-1' ? { ...img, x: 120, y: 160 } : img));
    expect(images[0].x).toBe(120);
    expect(images[0].y).toBe(160);

    // Commit new size during resize
    images = images.map((img) => (img.id === 'img-1' ? { ...img, width: 300, height: 220 } : img));
    expect(images[0].width).toBe(300);
    expect(images[0].height).toBe(220);
  });

  it('duplicates and deletes images', () => {
    let images: NoteImage[] = [sampleImage];

    // Duplicate image
    const duplicated: NoteImage = {
      ...sampleImage,
      id: 'img-2',
      x: sampleImage.x + 20,
      y: sampleImage.y + 20,
      createdAt: 2000,
    };
    images = [...images, duplicated];
    expect(images).toHaveLength(2);
    expect(images[1].id).toBe('img-2');
    expect(images[1].x).toBe(70);

    // Delete first image
    images = images.filter((img) => img.id !== 'img-1');
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe('img-2');
  });

  it('selects geometric rectangle stroke via lasso loop and moves it', () => {
    // A geometric rectangle shape stored as stroke
    const rectShapeStroke: Stroke = {
      id: 'rect-shape-1',
      pageId: 'page-1',
      toolType: 'pen',
      color: '#3f52ff',
      width: 3,
      opacity: 1,
      bounds: { minX: 100, minY: 100, maxX: 200, maxY: 200 },
      points: [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 200, y: 100, pressure: 0.5 },
        { x: 200, y: 200, pressure: 0.5 },
        { x: 100, y: 200, pressure: 0.5 },
        { x: 100, y: 100, pressure: 0.5 },
      ],
      createdAt: 1000,
    };

    // Draw lasso around rect (enclosing (100, 100) to (200, 200))
    const lassoLoop = [
      { x: 80, y: 80 },
      { x: 220, y: 80 },
      { x: 220, y: 220 },
      { x: 80, y: 220 },
    ];

    // Check if points are enclosed
    const isEnclosed = rectShapeStroke.points.some((pt) => isPointInPolygon(pt.x, pt.y, lassoLoop));
    expect(isEnclosed).toBe(true);

    // Move the rectangle by (+50, +30)
    const dx = 50;
    const dy = 30;
    const movedStroke: Stroke = {
      ...rectShapeStroke,
      points: rectShapeStroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };

    expect(movedStroke.points[0]).toEqual({ x: 150, y: 130, pressure: 0.5 });
    expect(movedStroke.points[2]).toEqual({ x: 250, y: 230, pressure: 0.5 });

    // History undo/redo for moving strokes
    const history = new HistoryManager(10);
    history.push({
      type: 'UPDATE_STROKES',
      prev: [rectShapeStroke],
      current: [movedStroke],
    });

    expect(history.canUndo()).toBe(true);
    const undoRes = history.undo({ strokes: [movedStroke], textBoxes: [] });
    expect(undoRes.strokes[0].points[0].x).toBe(100);

    const redoRes = history.redo({ strokes: undoRes.strokes, textBoxes: [] });
    expect(redoRes.strokes[0].points[0].x).toBe(150);
  });

  it('hit tests a shape stroke on click', () => {
    const lineStroke: Stroke = {
      id: 'line-1',
      pageId: 'page-1',
      toolType: 'pen',
      color: '#000000',
      width: 2,
      opacity: 1,
      bounds: { minX: 50, minY: 50, maxX: 200, maxY: 50 },
      points: [
        { x: 50, y: 50, pressure: 0.5 },
        { x: 200, y: 50, pressure: 0.5 },
      ],
      createdAt: 1000,
    };

    // Click near the line segment at (100, 52)
    const isHit = isStrokeNearPoint(lineStroke, 100, 52, 10);
    expect(isHit).toBe(true);

    // Click far away at (100, 150)
    const isMiss = isStrokeNearPoint(lineStroke, 100, 150, 10);
    expect(isMiss).toBe(false);
  });
});
