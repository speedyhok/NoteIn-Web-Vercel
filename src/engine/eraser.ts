import type { Point, Stroke, BoundingBox } from '../types';

/**
 * Returns the shortest distance from point P to line segment AB
 */
export function distanceToSegment(
  p: Point,
  a: Point,
  b: Point
): number {
  const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Consider the line extending the segment, parameterized as a + t (b - a).
  // We find projection of point p onto the line.
  // It falls where t = [(p-a) . (b-a)] / |b-a|^2
  // We clamp t from [0,1] to stay on segment
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * (b.x - a.x);
  const projY = a.y + t * (b.y - a.y);

  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Checks if two bounding boxes intersect
 */
export function doesBoundsOverlap(b1: BoundingBox, b2: BoundingBox): boolean {
  return !(
    b1.maxX < b2.minX ||
    b1.minX > b2.maxX ||
    b1.maxY < b2.minY ||
    b1.minY > b2.maxY
  );
}

/**
 * Tests whether an eraser circle at (x, y) with radius intersects a given stroke
 */
export function isStrokeIntersectedByEraser(
  eraserPoint: Point,
  eraserRadius: number,
  stroke: Stroke
): boolean {
  const eraserBounds: BoundingBox = {
    minX: eraserPoint.x - eraserRadius,
    minY: eraserPoint.y - eraserRadius,
    maxX: eraserPoint.x + eraserRadius,
    maxY: eraserPoint.y + eraserRadius,
  };

  // Quick bounding box rejection
  if (!doesBoundsOverlap(eraserBounds, stroke.bounds)) {
    return false;
  }

  const threshold = eraserRadius + stroke.width / 2;

  // Single point stroke (dot)
  if (stroke.points.length === 1) {
    const dist = Math.hypot(
      eraserPoint.x - stroke.points[0].x,
      eraserPoint.y - stroke.points[0].y
    );
    return dist <= threshold;
  }

  // Check each segment
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const p1 = stroke.points[i];
    const p2 = stroke.points[i + 1];

    if (distanceToSegment(eraserPoint, p1, p2) <= threshold) {
      return true;
    }
  }

  return false;
}
