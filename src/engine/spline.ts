import type { Point, BoundingBox } from '../types';

/**
 * Calculates bounding box of a collection of points with stroke padding
 */
export function calculateBoundingBox(points: Point[], strokeWidth: number): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  const halfWidth = strokeWidth / 2 + 2;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX: minX - halfWidth,
    minY: minY - halfWidth,
    maxX: maxX + halfWidth,
    maxY: maxY + halfWidth,
  };
}

/**
 * Resolves point thickness dynamically based on stylus pressure or velocity
 */
export function calculatePointWidth(
  baseWidth: number,
  point: Point,
  prevPoint?: Point,
  isHighlighter: boolean = false
): number {
  if (isHighlighter) {
    return baseWidth;
  }

  // Active stylus pressure (0.0 to 1.0)
  if (point.pressure > 0 && point.pressure !== 0.5) {
    // NoteIn fountain pen pressure curve: non-linear scaling between 0.35x and 1.65x
    const pressureScale = 0.35 + 1.3 * Math.pow(point.pressure, 1.2);
    return Math.max(1, baseWidth * pressureScale);
  }

  // Velocity-based fallback for mouse or basic touch
  if (prevPoint && point.time && prevPoint.time) {
    const dt = Math.max(1, point.time - prevPoint.time);
    const dist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
    const speed = dist / dt; // pixels per ms

    // Faster speed = thinner line, slower = bolder ink pooling
    const velocityFactor = Math.max(0.6, Math.min(1.4, 1.2 - speed * 0.15));
    return Math.max(1, baseWidth * velocityFactor);
  }

  return baseWidth;
}

/**
 * Computes midpoint between two points for quadratic Bezier smoothing
 */
export function getMidPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    pressure: (p1.pressure + p2.pressure) / 2,
    time: p1.time && p2.time ? (p1.time + p2.time) / 2 : undefined,
  };
}
