import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Copy, Trash2, Loader2 } from 'lucide-react';
import type { Page, Stroke, TextBox } from '../../types';
import * as db from '../../db';
import { renderPaperBackground } from '../../engine/paper';
import { renderStrokes } from '../../engine/renderer';

interface PageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  currentStrokes?: Stroke[];
  currentTextBoxes?: TextBox[];
}

interface PageThumbnailCanvasProps {
  page: Page;
  isCurrent: boolean;
  currentStrokes?: Stroke[];
  currentTextBoxes?: TextBox[];
}

const PageThumbnailCanvas: React.FC<PageThumbnailCanvasProps> = ({
  page,
  isCurrent,
  currentStrokes,
  currentTextBoxes,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedStrokes, setLoadedStrokes] = useState<Stroke[]>([]);
  const [loadedBoxes, setLoadedBoxes] = useState<TextBox[]>([]);
  const [isLoading, setIsLoading] = useState(!isCurrent);

  useEffect(() => {
    if (isCurrent && currentStrokes && currentTextBoxes) {
      setLoadedStrokes(currentStrokes);
      setLoadedBoxes(currentTextBoxes);
      setIsLoading(false);
      return;
    }

    let active = true;
    async function loadData() {
      try {
        const [s, tb] = await Promise.all([
          db.getStrokesForPage(page.id),
          db.getTextBoxesForPage(page.id),
        ]);
        if (active) {
          setLoadedStrokes(s);
          setLoadedBoxes(tb);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Page thumbnail load error:', err);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [page.id, isCurrent, currentStrokes, currentTextBoxes]);

  const isLandscape = page.orientation === 'landscape' || (page.width && page.height && page.width > page.height);
  const previewWidth = 260;
  const pageWidth = page.width || (isLandscape ? 1123 : 794);
  const pageHeight = page.height || (isLandscape ? 794 : 1123);
  const aspectRatio = pageWidth / pageHeight;
  const previewHeight = Math.round(previewWidth / aspectRatio);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewWidth * dpr;
    canvas.height = previewHeight * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const scaleX = previewWidth / pageWidth;
    const scaleY = previewHeight / pageHeight;
    ctx.scale(scaleX, scaleY);

    // 1. Render actual paper background & pattern lines
    renderPaperBackground(ctx, pageWidth, pageHeight, page.template, false);

    const drawContent = () => {
      const activeStrokes = isCurrent && currentStrokes ? currentStrokes : loadedStrokes;
      const activeBoxes = isCurrent && currentTextBoxes ? currentTextBoxes : loadedBoxes;

      if (activeStrokes && activeStrokes.length > 0) {
        renderStrokes(ctx, activeStrokes);
      }

      if (activeBoxes && activeBoxes.length > 0) {
        for (const tb of activeBoxes) {
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
    };

    // 2. Render background image if present (PDF page or imported background)
    if (page.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.drawImage(img, 0, 0, pageWidth, pageHeight);
        ctx.restore();
        drawContent();
      };
      img.src = page.backgroundImage;
    } else {
      drawContent();
    }

    ctx.restore();
  }, [page, isCurrent, currentStrokes, currentTextBoxes, loadedStrokes, loadedBoxes, previewWidth, previewHeight, pageWidth, pageHeight]);

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: `${pageWidth} / ${pageHeight}`,
        position: 'relative',
        backgroundColor: page.template.bgColor || '#ffffff',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isCurrent ? '0 0 0 2px #3f52ff, 0 4px 14px rgba(63, 82, 255, 0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
        border: isCurrent ? '2px solid #3f52ff' : '1px solid var(--border-subtle)',
        transition: 'all 0.15s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={16} className="animate-spin" color="#3f52ff" />
        </div>
      )}
    </div>
  );
};

export const PageDrawer: React.FC<PageDrawerProps> = ({
  isOpen,
  onClose,
  pages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  currentStrokes,
  currentTextBoxes,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          maxWidth: '85vw',
          zIndex: 90,
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.15)',
          animation: 'fadeIn 0.2s ease-out forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Page Overview
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thumbnail Page List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {pages.map((p, idx) => {
            const isCurrent = idx === currentPageIndex;
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  onClick={() => {
                    onSelectPage(idx);
                    onClose();
                  }}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  title={`Go to Page ${idx + 1}`}
                >
                  {/* Real Page Canvas Content Thumbnail */}
                  <PageThumbnailCanvas
                    page={p}
                    isCurrent={isCurrent}
                    currentStrokes={isCurrent ? currentStrokes : undefined}
                    currentTextBoxes={isCurrent ? currentTextBoxes : undefined}
                  />

                  {/* Page number badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: isCurrent ? '#3f52ff' : 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {idx + 1}
                  </div>
                </div>

                {/* Page Action Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#3f52ff' : 'var(--text-secondary)' }}>
                    Page {idx + 1} {isCurrent && '• Current'}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => onDuplicatePage(p.id)}
                      style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      title="Duplicate Page"
                    >
                      <Copy size={13} />
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={() => onDeletePage(p.id)}
                        style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        title="Delete Page"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Page Footer Button */}
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <button
            onClick={() => {
              onAddPage();
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: '#3f52ff',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(63, 82, 255, 0.3)',
            }}
          >
            <Plus size={16} />
            Insert New Page
          </button>
        </div>
      </div>
    </>
  );
};
