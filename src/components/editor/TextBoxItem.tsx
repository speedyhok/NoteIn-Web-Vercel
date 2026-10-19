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
  zoom: number;
}

// Check if string contains HTML tags
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

// Format raw text or HTML for viewing
function formatContentForDisplay(raw: string): string {
  if (!raw) return '';
  if (raw === 'Click to edit...' || raw === 'Click to edit') return '';

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
  zoom,
}) => {
  const initialContent = textBox.content === 'Click to edit...' || textBox.content === 'Click to edit'
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
    hasMoved: boolean;
  } | null>(null);

  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Sync content when prop changes
  useEffect(() => {
    const clean = textBox.content === 'Click to edit...' || textBox.content === 'Click to edit'
      ? ''
      : textBox.content;
    setContent(clean);
  }, [textBox.content]);

  // Measure and auto-expand dimensions to fit rich content, code cards, and tables
  const autoExpandDimensions = useCallback((el: HTMLElement) => {
    // el.scrollWidth measures rendered width of long lines, tables, code cards
    const measuredW = el.scrollWidth;
    const neededWidth = Math.min(1200, Math.max(textBox.width, Math.ceil(measuredW + 40)));

    // el.scrollHeight measures rendered height of all paragraphs, lists, and code blocks
    const measuredH = el.scrollHeight;
    const neededHeight = Math.max(textBox.height, Math.ceil(measuredH + 24));

    if (neededWidth !== textBox.width || neededHeight !== textBox.height) {
      onUpdateSize(neededWidth, neededHeight);
      onCommitSize(textBox.width, textBox.height, neededWidth, neededHeight);
    }
  }, [textBox.width, textBox.height, onUpdateSize, onCommitSize]);

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
    if (content === 'Click to edit...' || content === 'Click to edit') {
      setContent('');
    }
    onSelect();
    onStartEditing();
  }, [content, onSelect, onStartEditing]);

  // Drag on Card Body or Grip Handle
  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    // If already editing, allow cursor / text selection inside editor
    const isInsideEditor = editorRef.current && (e.target as Node) && editorRef.current.contains(e.target as Node);
    if (isEditing && isInsideEditor) {
      return;
    }

    try {
      if ('pointerId' in e) (e.currentTarget as any).setPointerCapture(e.pointerId);
    } catch {}

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: textBox.x,
      origY: textBox.y,
      hasMoved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - dragStartRef.current.clientX) / zoom;
    const dy = (e.clientY - dragStartRef.current.clientY) / zoom;

    if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 3) {
      dragStartRef.current.hasMoved = true;
    }

    if (dragStartRef.current.hasMoved) {
      const newX = Math.round(dragStartRef.current.origX + dx);
      const newY = Math.round(dragStartRef.current.origY + dy);
      onUpdatePosition(newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();

    if ('pointerId' in e) {
      try {
        (e.currentTarget as any).releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (dragStartRef.current) {
      const { origX, origY, hasMoved } = dragStartRef.current;
      dragStartRef.current = null;

      if (hasMoved) {
        if (textBox.x !== origX || textBox.y !== origY) {
          onCommitPosition(origX, origY, textBox.x, textBox.y);
        }
        return;
      }
    }

    handleStartEdit();
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
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    const dx = (e.clientX - resizeStartRef.current.clientX) / zoom;
    const dy = (e.clientY - resizeStartRef.current.clientY) / zoom;

    const newW = Math.max(80, Math.round(resizeStartRef.current.origW + dx));
    const newH = Math.max(30, Math.round(resizeStartRef.current.origH + dy));

    onUpdateSize(newW, newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!resizeStartRef.current) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { origW, origH } = resizeStartRef.current;
    resizeStartRef.current = null;

    if (textBox.width !== origW || textBox.height !== origH) {
      onCommitSize(origW, origH, textBox.width, textBox.height);
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
      onPointerDown={handlePointerDown}
      onMouseDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onMouseMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => {
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
        cursor: isEditing ? 'text' : isSelected ? 'move' : 'pointer',
        userSelect: isEditing ? 'text' : 'none',
        border: isSelected
          ? '1.5px dashed var(--accent-primary)'
          : textBox.borderColor && textBox.borderColor !== 'transparent'
          ? `1.5px solid ${textBox.borderColor}`
          : '1.5px solid transparent',
        borderRadius: `${textBox.borderRadius || 6}px`,
        padding: '6px 10px',
        backgroundColor: hasCustomBg ? bgColor : isSelected ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
        boxShadow: hasCustomBg ? '0 4px 14px rgba(0, 0, 0, 0.08)' : 'none',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Floating Selection Action Bar (Move Grip, Edit, Duplicate, Delete) */}
      {isSelected && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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
            cursor: 'grab',
            zIndex: 20,
          }}
        >
          <GripHorizontal size={13} color="var(--text-muted)" />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, userSelect: 'none' }}>
            Move
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            title="Edit Text"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Edit3 size={12} />
          </button>

          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate Text Box"
              style={{
                padding: '2px 4px',
                borderRadius: '2px',
                color: 'var(--text-secondary)',
              }}
            >
              <Copy size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Text Box"
            style={{
              padding: '2px 4px',
              borderRadius: '2px',
              color: 'var(--danger)',
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Editing Mode: Rich ContentEditable Editor (Retains full bold, colors, headings, lists & tabs) */}
      {isEditing ? (
        <div
          ref={editorRef}
          contentEditable={true}
          suppressContentEditableWarning={true}
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
            minHeight: `${textBox.height - 14}px`,
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
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            padding: 0,
            margin: 0,
            cursor: 'text',
          }}
        />
      ) : (
        /* Viewing Mode: Renders rich formatted HTML */
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
          style={{
            width: '100%',
            minHeight: `${textBox.height - 14}px`,
            fontFamily: textBox.fontFamily,
            fontSize: `${textBox.fontSize}px`,
            color: textBox.color,
            fontWeight: textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration,
            textAlign: textBox.alignment,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            cursor: isSelected ? 'move' : 'text',
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
              Click to edit...
            </span>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
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
