import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TextBox } from '../../types';
import { Trash2, GripHorizontal, Edit3, Copy } from 'lucide-react';
import { detectCodeSnippet, highlightCodeToHtml } from '../../engine/syntaxHighlighter';

interface TextBoxItemProps {
  textBox: TextBox;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onEndEditing: (newContent: string) => void;
  onUpdatePosition: (newX: number, newY: number) => void;
  onCommitPosition: (oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateSize: (newWidth: number, newHeight: number) => void;
  onCommitSize: (oldW: number, oldH: number, newW: number, newH: number) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onUpdateStyle?: (updates: Partial<TextBox>) => void;
  zoom: number;
}

// Check if string contains HTML tags
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

// Format raw text or HTML for viewing
function formatContentForDisplay(raw: string): string {
  if (!raw) return '';
  if (raw === 'Type notes here...' || raw === 'Click to edit') return '';

  // If contains HTML tags
  if (isHtml(raw)) {
    // Check if raw contains embedded markdown code blocks ```...```
    if (raw.includes('```')) {
      const codeRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]+?)\r?\n?```/g;
      return raw.replace(codeRegex, (_, lang, code) => {
        return highlightCodeToHtml(code.trim(), lang || 'code');
      });
    }
    return raw;
  }

  // If plain text, check if it is a code snippet
  const codeDetect = detectCodeSnippet(raw);
  if (codeDetect.isCode) {
    return highlightCodeToHtml(codeDetect.cleanedCode, codeDetect.language);
  }

  // Convert plain text: escape special characters, preserve tabs and line breaks
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
    .replace(/\r?\n/g, '<br>');
}

// Clean and sanitize HTML from clipboard while preserving ALL colors, fonts, styles, code blocks & formatting
function sanitizeClipboardHtml(rawHtml: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Remove potentially malicious or dangerous tags
    doc.querySelectorAll('script, iframe, object, embed, applet, head meta, head link').forEach((el) => el.remove());

    // 1. INLINE CSS from <style> tags (crucial for Google Docs, Word, Apple Notes, GitHub, Wikipedia)
    // Google Docs & Word output rules like: .c0 { color: #d9381e; font-weight: 700; font-size: 14pt; }
    const styles = Array.from(doc.querySelectorAll('style'));
    styles.forEach((styleEl) => {
      const cssText = styleEl.textContent || '';
      const ruleRegex = /([^{]+)\{([^}]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = ruleRegex.exec(cssText)) !== null) {
        const selector = match[1].trim();
        const styleBody = match[2].trim();
        if (selector.startsWith('@')) continue; // Skip @page, @media, @keyframes
        try {
          const elements = doc.querySelectorAll(selector);
          elements.forEach((el) => {
            if (el instanceof HTMLElement) {
              const existing = el.getAttribute('style') || '';
              // Prepend so that inline styles on the element keep higher precedence
              el.setAttribute('style', `${styleBody}; ${existing}`);
            }
          });
        } catch {
          // Ignore invalid or unsupported pseudo selectors
        }
      }
      styleEl.remove();
    });

    // 2. Convert legacy <font> tags to modern styled spans with colors
    doc.querySelectorAll('font').forEach((fontEl) => {
      const color = fontEl.getAttribute('color');
      const size = fontEl.getAttribute('size');
      const face = fontEl.getAttribute('face');
      const span = doc.createElement('span');
      let style = fontEl.getAttribute('style') || '';
      if (color) style += `color: ${color};`;
      if (face) style += `font-family: ${face};`;
      if (size) {
        const sizeMap: Record<string, string> = {
          '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px'
        };
        style += `font-size: ${sizeMap[size] || size};`;
      }
      span.setAttribute('style', style);
      span.innerHTML = fontEl.innerHTML;
      fontEl.replaceWith(span);
    });

    // 3. Enhance <pre> and <code> blocks if not already wrapped in .notein-code-card
    doc.querySelectorAll('pre').forEach((preEl) => {
      if (preEl.closest('.notein-code-card')) return;
      const codeChild = preEl.querySelector('code');
      const textToHighlight = codeChild ? codeChild.textContent || '' : preEl.textContent || '';
      const detected = detectCodeSnippet(textToHighlight);
      if (detected.isCode || textToHighlight.includes('\n') || preEl.tagName === 'PRE') {
        const highlighted = highlightCodeToHtml(textToHighlight, detected.language || 'code');
        const temp = doc.createElement('div');
        temp.innerHTML = highlighted;
        if (temp.firstElementChild) {
          preEl.replaceWith(temp.firstElementChild);
        }
      }
    });

    // 4. Check if the body itself contains a code snippet without rich formatting
    const body = doc.body;
    if (body) {
      const hasColoredSpans = body.querySelector('[style*="color"], [style*="background"], strong, b, em, i, u, table');
      const rawText = body.textContent || '';
      const codeDetect = detectCodeSnippet(rawText);
      if (!hasColoredSpans && codeDetect.isCode) {
        return highlightCodeToHtml(codeDetect.cleanedCode, codeDetect.language);
      }
      return body.innerHTML;
    }

    return rawHtml;
  } catch {
    return rawHtml;
  }
}

export const TextBoxItem: React.FC<TextBoxItemProps> = ({
  textBox,
  isSelected,
  isEditing,
  onSelect,
  onStartEditing,
  onEndEditing,
  onUpdatePosition,
  onCommitPosition,
  onUpdateSize,
  onCommitSize,
  onDelete,
  onDuplicate,
  onUpdateStyle,
  zoom,
}) => {
  const initialContent = textBox.content === 'Type notes here...' || textBox.content === 'Click to edit'
    ? ''
    : textBox.content;

  const [content, setContent] = useState(initialContent);
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const enterEditTimeRef = useRef<number>(0);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
    lastX: number;
    lastY: number;
    hasMoved: boolean;
  } | null>(null);

  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    origW: number;
    origH: number;
    lastW: number;
    lastH: number;
  } | null>(null);

  // Size before current edit session to commit only on session end
  const sizeBeforeEditRef = useRef<{ width: number; height: number }>({
    width: textBox.width,
    height: textBox.height,
  });

  useEffect(() => {
    if (isEditing) {
      sizeBeforeEditRef.current = { width: textBox.width, height: textBox.height };
    }
  }, [isEditing]);

  // Sync content when prop changes (only when not actively editing)
  useEffect(() => {
    if (isEditing) return;
    const clean = textBox.content === 'Type notes here...' || textBox.content === 'Click to edit'
      ? ''
      : textBox.content;
    setContent(clean);
  }, [textBox.content, isEditing]);

  // Measure and auto-fit dimensions snugly around the actual typed text
  const autoExpandDimensions = useCallback((el: HTMLElement) => {
    const rawText = el.innerText || '';
    const isBlank = !rawText.trim();
    const hasCustomBg = textBox.backgroundColor && textBox.backgroundColor !== 'transparent';

    let textW = 0;
    let textH = 0;

    if (!isBlank) {
      // Use an unconstrained measuring element to measure exact natural content width and height
      // without being constrained by the container's current width!
      // This ensures words never wrap prematurely on single lines and bounds hug the text tightly.
      const measureEl = document.createElement('div');
      measureEl.style.position = 'fixed';
      measureEl.style.left = '-9999px';
      measureEl.style.top = '-9999px';
      measureEl.style.visibility = 'hidden';
      measureEl.style.width = 'max-content';
      measureEl.style.maxWidth = '640px';
      measureEl.style.fontFamily = textBox.fontFamily;
      measureEl.style.fontSize = `${textBox.fontSize}px`;
      measureEl.style.fontWeight = textBox.bold ? 'bold' : 'normal';
      measureEl.style.fontStyle = textBox.italic ? 'italic' : 'normal';
      measureEl.style.lineHeight = '1.35';
      measureEl.style.whiteSpace = 'pre-wrap';
      measureEl.style.wordBreak = 'break-word';
      measureEl.style.padding = '0';
      measureEl.style.margin = '0';
      measureEl.innerHTML = el.innerHTML;
      document.body.appendChild(measureEl);
      const rect = measureEl.getBoundingClientRect();
      document.body.removeChild(measureEl);

      textW = Math.ceil(rect.width);
      textH = Math.ceil(rect.height);
    }

    let neededWidth: number;
    let neededHeight: number;

    if (hasCustomBg) {
      // Sticky Note cards have comfortable card min dimensions
      neededWidth = Math.max(160, textW + 24);
      neededHeight = Math.max(70, textH + 16);
    } else {
      // Plain text: fit tightly and snugly around the text only!
      // Padding is 3px top/bottom and 6px left/right (total 6px H, 12px W)
      neededWidth = isBlank ? 48 : Math.max(32, textW + 16);
      neededHeight = isBlank ? 26 : Math.max(22, textH + 6);
    }

    if (Math.abs(neededWidth - textBox.width) > 2 || Math.abs(neededHeight - textBox.height) > 2) {
      onUpdateSize(neededWidth, neededHeight);
    }
  }, [textBox.width, textBox.height, textBox.backgroundColor, textBox.fontFamily, textBox.fontSize, textBox.bold, textBox.italic, onUpdateSize]);

  const contentRef = useRef(content);
  contentRef.current = content;

  // When isEditing turns off, ensure any pending HTML is committed
  const isEditingRef = useRef(isEditing);
  useEffect(() => {
    if (isEditingRef.current && !isEditing) {
      const finalHtml = editorRef.current ? editorRef.current.innerHTML : contentRef.current;
      onEndEditing(finalHtml);
    }
    isEditingRef.current = isEditing;
  }, [isEditing, onEndEditing]);

  // Focus contentEditable editor when entering edit mode
  useEffect(() => {
    if (isEditing) {
      enterEditTimeRef.current = Date.now();
    }
    if (isEditing && editorRef.current) {
      const displayHtml = formatContentForDisplay(content);
      if (editorRef.current.innerHTML !== displayHtml) {
        editorRef.current.innerHTML = displayHtml;
      }
      editorRef.current.focus();
      autoExpandDimensions(editorRef.current);

      // Place cursor at the end of content
      try {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {}
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (content === 'Type notes here...' || content === 'Click to edit') {
      setContent('');
    }
    onSelect();
    onStartEditing();
  }, [content, onSelect, onStartEditing]);

  const [isDragging, setIsDragging] = useState(false);

  // Drag on Card Body or Grip Handle
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    // If already editing, allow cursor / text selection inside editor
    const isInsideEditor = editorRef.current && (e.target as Node) && editorRef.current.contains(e.target as Node);
    if (isEditing && isInsideEditor) {
      return;
    }

    // Crucial: prevent browser native drag ghost and text selection
    e.preventDefault();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: textBox.x,
      origY: textBox.y,
      lastX: textBox.x,
      lastY: textBox.y,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - dragStartRef.current.clientY) / zoom;

    if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
      if (isEditing) {
        const finalHtml = editorRef.current ? editorRef.current.innerHTML : content;
        onEndEditing(finalHtml);
      }
    }

    if (dragStartRef.current.hasMoved) {
      const newX = Math.round(dragStartRef.current.origX + dx);
      const newY = Math.round(dragStartRef.current.origY + dy);
      dragStartRef.current.lastX = newX;
      dragStartRef.current.lastY = newY;
      onUpdatePosition(newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    setIsDragging(false);

    if (dragStartRef.current) {
      const { origX, origY, lastX, lastY, hasMoved } = dragStartRef.current;
      dragStartRef.current = null;

      if (hasMoved) {
        if (lastX !== origX || lastY !== origY) {
          onCommitPosition(origX, origY, lastX, lastY);
        }
        return;
      }
    }

    // Single click: select the text box
    onSelect();
  };

  // Handle Resize
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origW: textBox.width,
      origH: textBox.height,
      lastW: textBox.width,
      lastH: textBox.height,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - resizeStartRef.current.clientX) / zoom;
    const dy = (e.clientY - resizeStartRef.current.clientY) / zoom;

    const newW = Math.max(80, Math.round(resizeStartRef.current.origW + dx));
    const newH = Math.max(30, Math.round(resizeStartRef.current.origH + dy));

    resizeStartRef.current.lastW = newW;
    resizeStartRef.current.lastH = newH;
    onUpdateSize(newW, newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { origW, origH, lastW, lastH } = resizeStartRef.current;
    resizeStartRef.current = null;

    if (lastW !== origW || lastH !== origH) {
      onCommitSize(origW, origH, lastW, lastH);
    }
  };

  // Blur / Commit editing
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Ignore blur during the initial click/release creation window
    if (Date.now() - enterEditTimeRef.current < 400) {
      setTimeout(() => {
        editorRef.current?.focus();
      }, 0);
      return;
    }

    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    const finalHtml = editorRef.current ? editorRef.current.innerHTML : content;

    // Commit expanded dimensions on editing session end
    if (
      textBox.width !== sizeBeforeEditRef.current.width ||
      textBox.height !== sizeBeforeEditRef.current.height
    ) {
      onCommitSize(
        sizeBeforeEditRef.current.width,
        sizeBeforeEditRef.current.height,
        textBox.width,
        textBox.height
      );
    }

    onEndEditing(finalHtml);
  };

  // Input change in contentEditable
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const updatedHtml = e.currentTarget.innerHTML;
    setContent(updatedHtml);
    if (editorRef.current) {
      autoExpandDimensions(editorRef.current);
    }
  };

  // Keyboard shortcuts (Escape, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === 'Escape') {
      const finalHtml = editorRef.current ? editorRef.current.innerHTML : content;
      onEndEditing(finalHtml);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  // Handle Paste: preserve exact formatting (rich text HTML, inlined colors, code blocks, or plain text) and auto-expand
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');

    let htmlToInsert = '';

    if (htmlData && htmlData.trim()) {
      htmlToInsert = sanitizeClipboardHtml(htmlData);
    } else if (textData) {
      const codeDetect = detectCodeSnippet(textData);
      if (codeDetect.isCode) {
        htmlToInsert = highlightCodeToHtml(codeDetect.cleanedCode, codeDetect.language);
      } else {
        htmlToInsert = formatContentForDisplay(textData);
      }
    }

    if (!htmlToInsert) return;

    // Use insertHTML to insert rich formatted content into contentEditable at selection
    document.execCommand('insertHTML', false, htmlToInsert);

    const updatedHtml = editorRef.current ? editorRef.current.innerHTML : htmlToInsert;
    setContent(updatedHtml);

    setTimeout(() => {
      if (editorRef.current) {
        autoExpandDimensions(editorRef.current);
      }
    }, 0);
  };

  // Text decorations
  const textDecorations: string[] = [];
  if (textBox.underline) textDecorations.push('underline');
  if (textBox.strikethrough) textDecorations.push('line-through');
  const textDecoration = textDecorations.length > 0 ? textDecorations.join(' ') : 'none';

  const bgColor = textBox.backgroundColor || 'transparent';
  const hasCustomBg = bgColor !== 'transparent';
  const displayHtml = formatContentForDisplay(content);
  const isDisplayEmpty = !displayHtml || displayHtml.trim() === '' || displayHtml === '<br>';

  return (
    <div
      ref={containerRef}
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleStartEdit();
      }}
      style={{
        position: 'absolute',
        left: `${textBox.x}px`,
        top: `${textBox.y}px`,
        width: `${textBox.width}px`,
        minHeight: `${textBox.height}px`,
        boxSizing: 'border-box',
        cursor: isDragging ? 'grabbing' : isEditing ? 'text' : isSelected ? 'move' : 'pointer',
        userSelect: isEditing ? 'text' : 'none',
        WebkitUserSelect: isEditing ? 'text' : 'none',
        border: isSelected
          ? '1.5px dashed var(--accent-primary)'
          : textBox.borderColor && textBox.borderColor !== 'transparent'
          ? `1.5px solid ${textBox.borderColor}`
          : '1.5px solid transparent',
        borderRadius: `${textBox.borderRadius || 6}px`,
        padding: hasCustomBg ? '8px 12px' : '3px 6px',
        backgroundColor: hasCustomBg ? bgColor : isSelected ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
        boxShadow: hasCustomBg ? '0 4px 14px rgba(0, 0, 0, 0.08)' : 'none',
        transition: isDragging ? 'none' : 'border-color 0.15s ease',
      }}
    >
      {/* Floating Selection Action Bar (Move Grip, Edit, Duplicate, Delete) */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '-28px',
            left: '0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '2px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 20,
            userSelect: 'none',
          }}
        >
          {/* Dedicated Move Grip */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              cursor: isDragging ? 'grabbing' : 'grab',
              padding: '2px 4px',
              borderRadius: '2px',
              userSelect: 'none',
            }}
            title="Drag to Move"
          >
            <GripHorizontal size={13} color="var(--text-muted)" />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, userSelect: 'none' }}>
              Move
            </span>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleStartEdit();
            }}
            title="Edit Text"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit3 size={12} />
          </button>

          {onDuplicate && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDuplicate();
              }}
              title="Duplicate Text Box"
              style={{
                padding: '2px 4px',
                borderRadius: '2px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Copy size={12} />
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            title="Delete Text Box"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--danger)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={12} />
          </button>

          {/* Quick Sticky Note Color Palette */}
          {onUpdateStyle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '5px' }}>
              {[
                { bg: 'transparent', border: 'transparent', label: 'Plain' },
                { bg: '#fef08a', border: '#facc15', label: 'Yellow Sticky' },
                { bg: '#bbf7d0', border: '#86efac', label: 'Mint Sticky' },
                { bg: '#bae6fd', border: '#7dd3fc', label: 'Sky Sticky' },
                { bg: '#fce7f3', border: '#f472b6', label: 'Rose Sticky' },
                { bg: '#e9d5ff', border: '#c084fc', label: 'Lavender Sticky' },
                { bg: '#1e293b', border: '#334155', label: 'Dark Card' },
              ].map((c) => (
                <button
                  key={c.bg}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const isDark = c.bg === '#1e293b';
                    onUpdateStyle({
                      backgroundColor: c.bg,
                      borderColor: c.border,
                      borderRadius: c.bg === 'transparent' ? 6 : 10,
                      color: isDark ? '#ffffff' : (textBox.color === '#ffffff' ? '#1c1917' : textBox.color),
                    });
                  }}
                  title={c.label}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: c.bg === 'transparent' ? '#f1f5f9' : c.bg,
                    border: c.bg === 'transparent' ? '1px dashed #94a3b8' : '1px solid rgba(0,0,0,0.18)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editing Mode: Rich ContentEditable Editor (Retains full bold, colors, headings, lists & tabs) */}
      {isEditing ? (
        <div
          key="textbox-editor-active"
          ref={editorRef}
          contentEditable={true}
          suppressContentEditableWarning={true}
          data-placeholder="Type notes here..."
          onInput={handleInput}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: textBox.fontFamily,
            fontSize: `${textBox.fontSize}px`,
            color: textBox.color,
            fontWeight: textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: textBox.alignment,
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            padding: 0,
            margin: 0,
            cursor: 'text',
          }}
        />
      ) : (
        /* Viewing Mode: Renders rich formatted HTML */
        <div
          key="textbox-viewer-rendered"
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isSelected) {
              handleStartEdit();
            } else {
              onSelect();
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
          style={{
            width: '100%',
            fontFamily: textBox.fontFamily,
            fontSize: `${textBox.fontSize}px`,
            color: textBox.color,
            fontWeight: textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: textBox.alignment,
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
            cursor: isDragging ? 'grabbing' : isSelected ? 'move' : 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {isDisplayEmpty ? (
            <span
              style={{
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Type notes here...
            </span>
          ) : (
            <div
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              dangerouslySetInnerHTML={{ __html: displayHtml }}
            />
          )}
        </div>
      )}

      {/* Resize Handle (Bottom-Right) */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          style={{
            position: 'absolute',
            right: '-5px',
            bottom: '-5px',
            width: '10px',
            height: '10px',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: '2px',
            cursor: 'nwse-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};
