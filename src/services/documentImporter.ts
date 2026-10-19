// NoteIn Document Importer & Exporter Service
// Supports PDF documents, NoteIn native packages (.notein, .in), Images, Markdown (.md), and Text (.txt)

import * as pdfjsLib from 'pdfjs-dist';
import * as db from '../db';
import type { Notebook, Page, Stroke, TextBox, NoteinPackage, PageOrientation, PaperTemplate } from '../types';

// Setup PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ImportResult {
  notebook: Notebook;
  pages: Page[];
  initialPageId: string;
}

const DEFAULT_TEMPLATE: PaperTemplate = {
  type: 'blank',
  lineSpacing: 28,
  gridSize: 20,
  patternColor: '#d0d7de',
  bgColor: '#ffffff',
};

/**
 * Imports a NoteIn package (.notein, .in, or JSON backup) into local Dexie IndexedDB.
 */
export async function importNoteinPackage(
  jsonString: string,
  sourceFilename?: string
): Promise<ImportResult> {
  const pkg = JSON.parse(jsonString) as Partial<NoteinPackage>;

  if (!pkg.notebook && !pkg.pages) {
    throw new Error('Invalid NoteIn package format: missing notebook or pages data');
  }

  const now = Date.now();
  const originalNotebook = pkg.notebook || ({} as any);
  const newNotebookId = crypto.randomUUID();

  // Create Notebook
  const notebook: Notebook = {
    id: newNotebookId,
    title: originalNotebook.title ? `${originalNotebook.title} (Imported)` : (sourceFilename?.replace(/\.[^/.]+$/, '') || 'Imported NoteIn Document'),
    coverColor: originalNotebook.coverColor || '#1d4ed8',
    coverPattern: originalNotebook.coverPattern || 'marble',
    defaultTemplate: originalNotebook.defaultTemplate || DEFAULT_TEMPLATE,
    orientation: originalNotebook.orientation || 'portrait',
    importedFrom: 'notein',
    sourceFilename: sourceFilename || originalNotebook.sourceFilename,
    pageCount: (pkg.pages && pkg.pages.length) || 1,
    createdAt: now,
    updatedAt: now,
  };

  const idMap = new Map<string, string>();
  const pages: Page[] = [];

  // Remap and insert pages
  const originalPages = pkg.pages || [];
  for (let i = 0; i < originalPages.length; i++) {
    const orig = originalPages[i];
    const newPageId = crypto.randomUUID();
    idMap.set(orig.id, newPageId);

    pages.push({
      ...orig,
      id: newPageId,
      notebookId: newNotebookId,
      pageNumber: i + 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (pages.length === 0) {
    // Ensure at least one page
    const pId = crypto.randomUUID();
    pages.push({
      id: pId,
      notebookId: newNotebookId,
      pageNumber: 1,
      title: 'Page 1',
      template: DEFAULT_TEMPLATE,
      width: 794,
      height: 1123,
      orientation: 'portrait',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Remap and insert strokes
  const originalStrokes = pkg.strokes || [];
  const strokes: Stroke[] = originalStrokes
    .filter((s) => idMap.has(s.pageId))
    .map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      pageId: idMap.get(s.pageId)!,
      createdAt: now,
    }));

  // Remap and insert text boxes
  const originalTextBoxes = pkg.textBoxes || [];
  const textBoxes: TextBox[] = originalTextBoxes
    .filter((tb) => idMap.has(tb.pageId))
    .map((tb) => ({
      ...tb,
      id: crypto.randomUUID(),
      pageId: idMap.get(tb.pageId)!,
      createdAt: now,
      updatedAt: now,
    }));

  // Save to Dexie
  await (db as any).db.transaction('rw', (db as any).db.notebooks, (db as any).db.pages, (db as any).db.strokes, (db as any).db.textBoxes, async () => {
    await (db as any).db.notebooks.add(notebook);
    await (db as any).db.pages.bulkAdd(pages);
    if (strokes.length > 0) {
      await (db as any).db.strokes.bulkAdd(strokes);
    }
    if (textBoxes.length > 0) {
      await (db as any).db.textBoxes.bulkAdd(textBoxes);
    }
  });

  return {
    notebook,
    pages,
    initialPageId: pages[0].id,
  };
}

/**
 * Imports a PDF document, rendering its pages as high-resolution note pages.
 */
export async function importPdfDocument(
  arrayBuffer: ArrayBuffer,
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const title = filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  const notebookId = crypto.randomUUID();
  const now = Date.now();

  const pages: Page[] = [];

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages);

    const page = await pdf.getPage(i);
    // Standard target page width: 794px (A4 at 96 DPI)
    const baseViewport = page.getViewport({ scale: 1.0 });
    const targetWidth = 794;
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    // Render to off-screen canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');

    let pageBgDataUrl = '';
    if (ctx) {
      await (page.render as any)({
        canvasContext: ctx,
        viewport,
      }).promise;
      pageBgDataUrl = canvas.toDataURL('image/png', 0.92);
    }

    const isLandscape = viewport.width > viewport.height;
    const pageId = crypto.randomUUID();

    pages.push({
      id: pageId,
      notebookId,
      pageNumber: i,
      title: `Page ${i}`,
      template: {
        type: 'blank',
        lineSpacing: 28,
        gridSize: 20,
        patternColor: '#e2e8f0',
        bgColor: '#ffffff',
      },
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      orientation: isLandscape ? 'landscape' : 'portrait',
      backgroundImage: pageBgDataUrl,
      createdAt: now,
      updatedAt: now,
    });
  }

  const initialOrientation: PageOrientation = pages[0]?.orientation || 'portrait';

  const notebook: Notebook = {
    id: notebookId,
    title,
    coverColor: '#b91c1c', // Ruby PDF cover accent
    coverPattern: 'minimal',
    defaultTemplate: DEFAULT_TEMPLATE,
    orientation: initialOrientation,
    importedFrom: 'pdf',
    sourceFilename: filename,
    pageCount: pages.length,
    createdAt: now,
    updatedAt: now,
  };

  await (db as any).db.transaction('rw', (db as any).db.notebooks, (db as any).db.pages, async () => {
    await (db as any).db.notebooks.add(notebook);
    await (db as any).db.pages.bulkAdd(pages);
  });

  return {
    notebook,
    pages,
    initialPageId: pages[0].id,
  };
}

/**
 * Imports an image file as a new NoteIn notebook page.
 */
export async function importImageDocument(
  dataUrl: string,
  filename: string
): Promise<ImportResult> {
  const cleanTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const notebookId = crypto.randomUUID();
  const pageId = crypto.randomUUID();
  const now = Date.now();

  // Measure image aspect ratio
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = dataUrl;
  });

  const width = Math.min(1200, Math.max(794, img.naturalWidth || 794));
  const height = Math.round(width * ((img.naturalHeight || 1123) / (img.naturalWidth || 794)));
  const orientation: PageOrientation = width > height ? 'landscape' : 'portrait';

  const page: Page = {
    id: pageId,
    notebookId,
    pageNumber: 1,
    title: 'Image Note',
    template: DEFAULT_TEMPLATE,
    width,
    height,
    orientation,
    backgroundImage: dataUrl,
    createdAt: now,
    updatedAt: now,
  };

  const notebook: Notebook = {
    id: notebookId,
    title: cleanTitle,
    coverColor: '#047857',
    coverPattern: 'gradient',
    defaultTemplate: DEFAULT_TEMPLATE,
    orientation,
    importedFrom: 'image',
    sourceFilename: filename,
    pageCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  await (db as any).db.transaction('rw', (db as any).db.notebooks, (db as any).db.pages, async () => {
    await (db as any).db.notebooks.add(notebook);
    await (db as any).db.pages.add(page);
  });

  return {
    notebook,
    pages: [page],
    initialPageId: pageId,
  };
}

/**
 * Imports a Markdown or Text document into a new structured NoteIn notebook.
 */
export async function importMarkdownOrText(
  text: string,
  filename: string
): Promise<ImportResult> {
  const cleanTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const notebookId = crypto.randomUUID();
  const pageId = crypto.randomUUID();
  const now = Date.now();

  const lines = text.split(/\r?\n/);
  let htmlContent = '';

  for (const line of lines) {
    if (line.startsWith('# ')) {
      htmlContent += `<h1 style="color: rgb(30, 58, 138); font-size: 22px; font-weight: bold; margin: 12px 0 6px 0;">${line.substring(2)}</h1>`;
    } else if (line.startsWith('## ')) {
      htmlContent += `<h2 style="color: rgb(15, 118, 110); font-size: 18px; font-weight: bold; margin: 10px 0 4px 0;">${line.substring(3)}</h2>`;
    } else if (line.startsWith('### ')) {
      htmlContent += `<h3 style="color: rgb(79, 70, 229); font-size: 15px; font-weight: bold; margin: 8px 0 4px 0;">${line.substring(4)}</h3>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      htmlContent += `<li style="margin-left: 20px; line-height: 1.6;">${line.substring(2)}</li>`;
    } else if (line.trim()) {
      htmlContent += `<p style="margin: 4px 0; line-height: 1.6;">${line}</p>`;
    } else {
      htmlContent += `<br>`;
    }
  }

  const page: Page = {
    id: pageId,
    notebookId,
    pageNumber: 1,
    title: 'Page 1',
    template: {
      type: 'ruled',
      lineSpacing: 28,
      gridSize: 20,
      patternColor: '#d0d7de',
      bgColor: '#ffffff',
    },
    width: 794,
    height: 1123,
    orientation: 'portrait',
    createdAt: now,
    updatedAt: now,
  };

  const textBox: TextBox = {
    id: crypto.randomUUID(),
    pageId,
    x: 100,
    y: 120,
    width: 600,
    height: 400,
    content: htmlContent || '<p>Imported document text.</p>',
    fontFamily: 'Inter, sans-serif',
    fontSize: 16,
    color: '#1e293b',
    bold: false,
    italic: false,
    alignment: 'left',
    createdAt: now,
    updatedAt: now,
  };

  const notebook: Notebook = {
    id: notebookId,
    title: cleanTitle,
    coverColor: '#4338ca',
    coverPattern: 'solid',
    defaultTemplate: page.template,
    orientation: 'portrait',
    importedFrom: 'markdown',
    sourceFilename: filename,
    pageCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  await (db as any).db.transaction('rw', (db as any).db.notebooks, (db as any).db.pages, (db as any).db.textBoxes, async () => {
    await (db as any).db.notebooks.add(notebook);
    await (db as any).db.pages.add(page);
    await (db as any).db.textBoxes.add(textBox);
  });

  return {
    notebook,
    pages: [page],
    initialPageId: pageId,
  };
}

/**
 * Universal document import dispatcher.
 */
export async function importAnyDocument(
  file: File | { data: string | ArrayBuffer; filename: string; mimeType?: string },
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  let filename = '';
  let bufferOrString: ArrayBuffer | string = '';

  if (file instanceof File) {
    filename = file.name;
    if (filename.endsWith('.pdf')) {
      bufferOrString = await file.arrayBuffer();
    } else if (filename.endsWith('.notein') || filename.endsWith('.in') || filename.endsWith('.json') || filename.endsWith('.md') || filename.endsWith('.txt')) {
      bufferOrString = await file.text();
    } else if (file.type.startsWith('image/')) {
      bufferOrString = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(file);
      });
    } else {
      bufferOrString = await file.text();
    }
  } else {
    filename = file.filename;
    bufferOrString = file.data;
  }

  const lower = filename.toLowerCase();

  // 1. NoteIn Native Package (.notein, .in, or JSON backup)
  if (lower.endsWith('.notein') || lower.endsWith('.in') || (typeof bufferOrString === 'string' && bufferOrString.includes('"app":"NoteIn"'))) {
    const jsonStr = typeof bufferOrString === 'string' ? bufferOrString : new TextDecoder().decode(bufferOrString);
    return await importNoteinPackage(jsonStr, filename);
  }

  // 2. PDF Document
  if (lower.endsWith('.pdf')) {
    let arrayBuffer: ArrayBuffer;
    if (typeof bufferOrString === 'string') {
      const binary = atob(bufferOrString.replace(/^data:application\/pdf;base64,/, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      arrayBuffer = bytes.buffer;
    } else {
      arrayBuffer = bufferOrString;
    }
    return await importPdfDocument(arrayBuffer, filename, onProgress);
  }

  // 3. Image
  if (lower.match(/\.(png|jpe?g|webp|svg|gif|bmp)$/i) || (typeof bufferOrString === 'string' && bufferOrString.startsWith('data:image/'))) {
    const dataUrl = typeof bufferOrString === 'string' ? bufferOrString : '';
    return await importImageDocument(dataUrl, filename);
  }

  // 4. Markdown & Plain Text
  if (lower.endsWith('.md') || lower.endsWith('.txt')) {
    const textStr = typeof bufferOrString === 'string' ? bufferOrString : new TextDecoder().decode(bufferOrString);
    return await importMarkdownOrText(textStr, filename);
  }

  // Fallback to text import
  const rawText = typeof bufferOrString === 'string' ? bufferOrString : new TextDecoder().decode(bufferOrString);
  return await importMarkdownOrText(rawText, filename);
}

/**
 * Exports a full NoteIn notebook as a downloadable .notein package.
 */
export async function exportNotebookAsNotein(notebookId: string): Promise<string> {
  const notebook = await db.getNotebook(notebookId);
  if (!notebook) throw new Error('Notebook not found');

  const pages = await db.getPagesForNotebook(notebookId);
  const allStrokes: Stroke[] = [];
  const allTextBoxes: TextBox[] = [];

  for (const p of pages) {
    const strokes = await db.getStrokesForPage(p.id);
    const textBoxes = await db.getTextBoxesForPage(p.id);
    allStrokes.push(...strokes);
    allTextBoxes.push(...textBoxes);
  }

  const pkg: NoteinPackage = {
    version: '2.0',
    app: 'NoteIn',
    exportedAt: Date.now(),
    notebook,
    pages,
    strokes: allStrokes,
    textBoxes: allTextBoxes,
  };

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${notebook.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.notein`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return json;
}
