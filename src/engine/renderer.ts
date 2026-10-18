import type { Stroke } from '../types';
import { calculatePointWidth, getMidPoint } from './spline';

/**
 * Renders a single vector stroke onto canvas
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
): void {
  const { points, color, width, toolType, opacity } = stroke;
  if (!points || points.length === 0) return;

  ctx.save();

  if (toolType === 'highlighter') {
    // Highlighter mode: translucent multiply blend mode to let text/lines shine through
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = opacity || 0.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Normal Pen Mode (Fountain / Ballpoint / Pencil)
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity || 1.0;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    const ptWidth = calculatePointWidth(width, points[0]);
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ptWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Render variable-width stroke segments using quadratic bezier curves
  let prevMid = points[0];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const mid = getMidPoint(p1, p2);

    const segmentWidth = calculatePointWidth(width, p1, i > 0 ? points[i - 1] : undefined);

    ctx.beginPath();
    ctx.lineWidth = segmentWidth;
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
    ctx.stroke();

    prevMid = mid;
  }

  // Final segment to last point
  if (points.length > 1) {
    const lastP = points[points.length - 1];
    const secondLast = points[points.length - 2];
    const lastWidth = calculatePointWidth(width, lastP, secondLast);

    ctx.beginPath();
    ctx.lineWidth = lastWidth;
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.lineTo(lastP.x, lastP.y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders all strokes in order onto a canvas context
 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[]
): void {
  // First render highlighters so normal ink stays crisp on top
  for (const s of strokes) {
    if (s.toolType === 'highlighter') {
      renderStroke(ctx, s);
    }
  }

  // Then render standard ink pens
  for (const s of strokes) {
    if (s.toolType !== 'highlighter') {
      renderStroke(ctx, s);
    }
  }
}
