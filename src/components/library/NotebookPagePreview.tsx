import React, { useEffect, useRef, useState } from 'react';
import type { Notebook, Page, Stroke, TextBox } from '../../types';
import * as db from '../../db';
import { renderPaperBackground } from '../../engine/paper';
import { renderStrokes } from '../../engine/renderer';

interface NotebookPagePreviewProps {
  notebook: Notebook;
  scale?: number;
  hideBadge?: boolean;
}

export const NotebookPagePreview: React.FC<NotebookPagePreviewProps> = ({ notebook, scale = 1, hideBadge = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const pages = await db.getPagesForNotebook(notebook.id);
        if (!active) return;
        const firstPage = pages[0] || null;
        if (firstPage) {
          const [loadedStrokes, loadedBoxes] = await Promise.all([
            db.getStrokesForPage(firstPage.id),
            db.getTextBoxesForPage(firstPage.id),
          ]);
          if (!active) return;
          setPage(firstPage);
          setStrokes(loadedStrokes);
          setTextBoxes(loadedBoxes);
        }
      } catch (err) {
        console.warn('Preview load error:', err);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [notebook.id, notebook.updatedAt]);

  const isLandscape = (page?.orientation || notebook.orientation) === 'landscape';

  // Standard preview dimensions preserving A4 aspect ratio (1:1.414)
  const baseWidth = isLandscape ? 170 : 124;
  const baseHeight = isLandscape ? 124 : 172;
  const sheetWidth = Math.round(baseWidth * scale);
  const sheetHeight = Math.round(baseHeight * scale);

  const pageWidth = page?.width || (isLandscape ? 1123 : 794);
  const pageHeight = page?.height || (isLandscape ? 794 : 1123);
  const template = page?.template || notebook.defaultTemplate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = sheetWidth * dpr;
    canvas.height = sheetHeight * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const scaleX = sheetWidth / pageWidth;
    const scaleY = sheetHeight / pageHeight;
    ctx.scale(scaleX, scaleY);

    // 1. Render actual paper background & pattern lines (Ruled, Grid, Dotted, Cornell, Blank)
    renderPaperBackground(ctx, pageWidth, pageHeight, template, false);

    // 2. Render background image if present (PDF page or imported image)
    if (page?.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.drawImage(img, 0, 0, pageWidth, pageHeight);
        if (strokes.length > 0) renderStrokes(ctx, strokes);
        renderTextBoxes(ctx, textBoxes);
        ctx.restore();
      };
      img.src = page.backgroundImage;
    }

    // 3. Render real vector handwriting and strokes
    if (strokes.length > 0) {
      renderStrokes(ctx, strokes);
    }

    // 4. Render text boxes
    renderTextBoxes(ctx, textBoxes);

    ctx.restore();
  }, [page, strokes, textBoxes, sheetWidth, sheetHeight, pageWidth, pageHeight, template]);

  function renderTextBoxes(ctx: CanvasRenderingContext2D, boxes: TextBox[]) {
    for (const tb of boxes) {
      if (!tb.content) continue;
      ctx.save();
      if (tb.backgroundColor && tb.backgroundColor !== 'transparent') {
        ctx.fillStyle = tb.backgroundColor;
        ctx.fillRect(tb.x, tb.y, tb.width, tb.height);
      }
      ctx.font = `${tb.bold ? 'bold ' : ''}${tb.italic ? 'italic ' : ''}${Math.max(12, tb.fontSize)}px ${tb.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = tb.color || '#1e293b';
      const lines = tb.content.split('\n');
      const lineHeight = tb.fontSize * 1.25;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tb.x + 4, tb.y + 4 + (i + 1) * lineHeight);
      }
      ctx.restore();
    }
  }

  const pageCount = notebook.pageCount || 1;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Layered paper stack behind sheet 1 if pageCount > 1 */}
      {pageCount > 1 && (
        <div
          style={{
            position: 'absolute',
            width: `${sheetWidth}px`,
            height: `${sheetHeight}px`,
            backgroundColor: '#e2e8f0',
            borderRadius: '5px',
            transform: 'translate(4px, 4px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        />
      )}
      {pageCount > 2 && (
        <div
          style={{
            position: 'absolute',
            width: `${sheetWidth}px`,
            height: `${sheetHeight}px`,
            backgroundColor: '#cbd5e1',
            borderRadius: '5px',
            transform: 'translate(7px, 7px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        />
      )}

      {/* Main Front Document Page Sheet (Like the file itself) */}
      <div
        className="notebook-page-sheet"
        style={{
          width: `${sheetWidth}px`,
          height: `${sheetHeight}px`,
          position: 'relative',
          borderRadius: '5px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.09)',
          overflow: 'hidden',
          backgroundColor: template.bgColor || '#ffffff',
          zIndex: 2,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: `${sheetWidth}px`,
            height: `${sheetHeight}px`,
            display: 'block',
          }}
        />
      </div>

      {/* Page Count Badge in top right */}
      {!hideBadge && (
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          padding: '2px 7px',
          borderRadius: '9999px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          zIndex: 4,
        }}
      >
        {pageCount} {pageCount === 1 ? 'pg' : 'pgs'}
      </div>
      )}
    </div>
  );
};
