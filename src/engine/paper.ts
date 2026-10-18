import type { PaperTemplate } from '../types';

/**
 * Renders paper patterns cleanly onto an HTML5 canvas context in page coordinates
 */
export function renderPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: PaperTemplate,
  isDarkMode: boolean = false
): void {
  ctx.save();

  // Background Fill
  const bgColor = isDarkMode
    ? (template.bgColor === '#ffffff' ? '#18181b' : template.bgColor)
    : template.bgColor;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const patternColor = isDarkMode
    ? '#27272a'
    : (template.patternColor || '#e2e8f0');

  ctx.lineWidth = 1;
  ctx.strokeStyle = patternColor;

  switch (template.type) {
    case 'ruled': {
      const spacing = template.lineSpacing || 28;
      const topMargin = 70;
      const bottomMargin = 50;
      const leftMarginLine = 90;

      // Draw horizontal ruled lines
      ctx.beginPath();
      for (let y = topMargin; y <= height - bottomMargin; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Left vertical margin line (subtle red or pinkish accent in light, subtle rose in dark)
      ctx.beginPath();
      ctx.strokeStyle = isDarkMode ? '#7f1d1d' : '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.moveTo(leftMarginLine, 0);
      ctx.lineTo(leftMarginLine, height);
      ctx.stroke();
      break;
    }

    case 'grid': {
      const size = template.gridSize || 20;

      ctx.beginPath();
      // Vertical lines
      for (let x = 0; x <= width; x += size) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      // Horizontal lines
      for (let y = 0; y <= height; y += size) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      break;
    }

    case 'dotted': {
      const size = template.gridSize || 20;
      const dotRadius = 1.0;
      ctx.fillStyle = patternColor;

      for (let x = size; x < width; x += size) {
        for (let y = size; y < height; y += size) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'cornell': {
      const topHeaderH = 65;
      const cueColW = 190;
      const bottomSummaryH = 150;
      const spacing = template.lineSpacing || 28;

      // Dividers
      ctx.beginPath();
      ctx.strokeStyle = isDarkMode ? '#3f3f46' : '#cbd5e1';
      ctx.lineWidth = 2;

      // Top title separator
      ctx.moveTo(0, topHeaderH);
      ctx.lineTo(width, topHeaderH);

      // Vertical Cue column line
      ctx.moveTo(cueColW, topHeaderH);
      ctx.lineTo(cueColW, height - bottomSummaryH);

      // Bottom summary separator
      ctx.moveTo(0, height - bottomSummaryH);
      ctx.lineTo(width, height - bottomSummaryH);
      ctx.stroke();

      // Ruled lines in main note taking area
      ctx.beginPath();
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 1;

      for (let y = topHeaderH + spacing; y < height - bottomSummaryH; y += spacing) {
        ctx.moveTo(cueColW, y);
        ctx.lineTo(width, y);
      }

      // Ruled lines in summary area
      for (let y = height - bottomSummaryH + spacing; y < height - 20; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      break;
    }

    case 'blank':
    default:
      // Blank page only has the solid fill
      break;
  }

  ctx.restore();
}
