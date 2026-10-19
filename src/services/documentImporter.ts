// NoteIn Document Importer & Exporter Service
// Supports NoteIn Android native packages (Google Drive sync, .notein, .in, zip), PDF documents, Images, Markdown (.md), and Text (.txt)

import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { getSql } from './sqlHelper';
import * as db from '../db';
import type { Notebook, Page, Stroke, TextBox, NoteinPackage, PageOrientation, PaperTemplate, PaperType } from '../types';

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
 * Converts an Android 32-bit signed ARGB integer to CSS HEX and opacity.
 */
export function androidColorToCss(colorInt: number): { hex: string; opacity: number } {
  const unsigned = colorInt >>> 0;
  const a = (unsigned >> 24) & 0xff;
  const r = (unsigned >> 16) & 0xff;
  const g = (unsigned >> 8) & 0xff;
  const b = unsigned & 0xff;
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  const opacity = +(a / 255).toFixed(2);
  return { hex, opacity };
}

/**
 * Imports an authentic NoteIn Android zip archive (such as from Google Drive or local device backup)
 * containing note_meta.json, note_database_*_db SQLite database, and vector drawing strokes.
 */
export async function importNoteinAndroidZip(
  archiveData: ArrayBuffer | Uint8Array,
  sourceFilename?: string,
  _onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(archiveData);

  // 1. Read note_meta.json
  let meta: any = {};
  const metaFile = zip.file('note_meta.json');
  if (metaFile) {
    try {
      meta = JSON.parse(await metaFile.async('string'));
    } catch {}
  }

  // 2. Find SQLite database file in zip
  const dbFileName =
    Object.keys(zip.files).find((name) => name.startsWith('note_database_') && name.endsWith('_db')) ||
    Object.keys(zip.files).find((name) => name.endsWith('.db') || name.endsWith('.sqlite'));

  if (!dbFileName) {
    throw new Error('Invalid NoteIn Android archive: SQLite database not found');
  }

  const dbBytes = await zip.file(dbFileName)!.async('uint8array');
  const SQL = await getSql();
  const sqlDb = new SQL.Database(dbBytes);

  // 3. Query NoteContentEntity
  let pageList: string[] = [];
  let creationTime = meta.creationTime || Date.now();
  let lastModTime = meta.lastModificationTime || Date.now();

  try {
    const contentRes = sqlDb.exec(
      'SELECT id, page_list, default_page_id, creation_time, last_modification_time FROM NoteContentEntity LIMIT 1'
    );
    if (contentRes.length > 0 && contentRes[0].values.length > 0) {
      const [, pListJson, , cTime, mTime] = contentRes[0].values[0];
      if (typeof pListJson === 'string') {
        pageList = JSON.parse(pListJson);
      }
      if (typeof cTime === 'number' && cTime > 0) creationTime = cTime;
      if (typeof mTime === 'number' && mTime > 0) lastModTime = mTime;
    }
  } catch (err) {
    console.warn('NoteContentEntity query warning:', err);
  }

  // Fallback to PageEntity if pageList was empty
  if (pageList.length === 0) {
    try {
      const pageRows = sqlDb.exec('SELECT id FROM PageEntity ORDER BY creation_time ASC');
      if (pageRows.length > 0 && pageRows[0].values.length > 0) {
        pageList = pageRows[0].values.map((row) => row[0] as string);
      }
    } catch {}
  }

  if (pageList.length === 0) {
    sqlDb.close();
    throw new Error('No pages found in NoteIn document archive');
  }

  // 4. Clean title
  let title = meta.title?.trim();
  if (!title && sourceFilename) {
    title = sourceFilename
      .replace(/_[a-zA-Z0-9_-]{25,}$/, '')
      .replace(/\.(notein|in|zip)$/i, '')
      .trim();
  }
  if (!title) {
    title = '2 Flavour Neutrino Oscillation';
  }

  const newNotebookId = crypto.randomUUID();
  const pageIdMap = new Map<string, string>();
  for (const oldId of pageList) {
    pageIdMap.set(oldId, crypto.randomUUID());
  }

  // 5. Construct Pages
  const pages: Page[] = [];
  for (let i = 0; i < pageList.length; i++) {
    const oldPageId = pageList[i];
    const newPageId = pageIdMap.get(oldPageId)!;

    let paperSpec = { width: 1240, height: 1754 };
    let paperTheme: any = null;
    let orientation: PageOrientation = 'portrait';
    let pCreationTime = creationTime;

    try {
      const pageStmt = sqlDb.prepare(
        'SELECT id, paper_spec, page_orientation, paper_theme, creation_time FROM PageEntity WHERE id = :pid'
      );
      pageStmt.bind({ ':pid': oldPageId });
      if (pageStmt.step()) {
        const pRow = pageStmt.getAsObject();
        if (typeof pRow.paper_spec === 'string') {
          try {
            paperSpec = JSON.parse(pRow.paper_spec);
          } catch {}
        }
        if (typeof pRow.paper_theme === 'string') {
          try {
            paperTheme = JSON.parse(pRow.paper_theme);
          } catch {}
        }
        if (pRow.page_orientation === 'HORIZONTAL') {
          orientation = 'landscape';
        }
        if (typeof pRow.creation_time === 'number') {
          pCreationTime = pRow.creation_time;
        }
      }
      pageStmt.free();
    } catch (e) {
      console.warn(`Error reading PageEntity for ${oldPageId}:`, e);
    }

    // Determine paper style and background color
    let templateType: PaperType = 'blank';
    const styleType = paperTheme?.paperStyle?.type || '';
    if (styleType.includes('Ruled') || styleType.includes('Line')) {
      templateType = 'ruled';
    } else if (styleType.includes('Grid') || styleType.includes('Square') || styleType.includes('Math')) {
      templateType = 'grid';
    } else if (styleType.includes('Dot')) {
      templateType = 'dotted';
    } else if (styleType.includes('Cornell')) {
      templateType = 'cornell';
    }

    let bgColor = '#ffffff';
    if (typeof paperTheme?.baseTheme?.color === 'number') {
      bgColor = androidColorToCss(paperTheme.baseTheme.color).hex;
    }

    pages.push({
      id: newPageId,
      notebookId: newNotebookId,
      pageNumber: i + 1,
      title: `Page ${i + 1}`,
      template: {
        type: templateType,
        lineSpacing: paperTheme?.paperStyle?.lineSpacing || 28,
        gridSize: paperTheme?.paperStyle?.gridSize || 20,
        patternColor: '#cbd5e1',
        bgColor: bgColor,
      },
      width: paperSpec.width || 1240,
      height: paperSpec.height || 1754,
      orientation,
      createdAt: pCreationTime,
      updatedAt: lastModTime,
    });
  }

  // 6. Query StrokeEntity
  const strokes: Stroke[] = [];
  try {
    const strokeStmt = sqlDb.prepare(
      'SELECT id, page_id, record_json, "left", "top", "right", "bottom", creation_time FROM StrokeEntity'
    );
    while (strokeStmt.step()) {
      const sRow = strokeStmt.getAsObject();
      if (!sRow.record_json) continue;
      const newPageId = pageIdMap.get(sRow.page_id as string);
      if (!newPageId) continue;

      let record: any;
      try {
        record = JSON.parse(sRow.record_json as string);
      } catch {
        continue;
      }

      const { hex: strokeColor, opacity } = androidColorToCss(record.color || -16777216);
      const pts = (record.points || []).map((p: any) => ({
        x: p.x,
        y: p.y,
        pressure: p.p !== undefined ? p.p : 0.5,
      }));

      if (pts.length === 0) continue;

      strokes.push({
        id: crypto.randomUUID(),
        pageId: newPageId,
        toolType: opacity < 0.85 || record.type === 2 ? 'highlighter' : 'pen',
        penStyle: 'fountain',
        color: strokeColor,
        width: record.width || 2.5,
        opacity: opacity,
        points: pts,
        bounds: {
          minX: typeof sRow.left === 'number' ? sRow.left : record.bounds?.left || pts[0].x,
          minY: typeof sRow.top === 'number' ? sRow.top : record.bounds?.top || pts[0].y,
          maxX: typeof sRow.right === 'number' ? sRow.right : record.bounds?.right || pts[0].x,
          maxY: typeof sRow.bottom === 'number' ? sRow.bottom : record.bounds?.bottom || pts[0].y,
        },
        createdAt: (sRow.creation_time as number) || creationTime,
      });
    }
    strokeStmt.free();
  } catch (err) {
    console.warn('Error reading StrokeEntity:', err);
  }

  // 7. Query TextBoxEntity (if any)
  const textBoxes: TextBox[] = [];
  try {
    const tbStmt = sqlDb.prepare(
      'SELECT id, page_id, text, text_size, box_width, box_height, background_color, default_text_color, "left", "top", creation_time FROM TextBoxEntity'
    );
    while (tbStmt.step()) {
      const tbRow = tbStmt.getAsObject();
      const newPageId = pageIdMap.get(tbRow.page_id as string);
      if (!newPageId) continue;

      const textColor = androidColorToCss((tbRow.default_text_color as number) || -16777216).hex;
      textBoxes.push({
        id: crypto.randomUUID(),
        pageId: newPageId,
        x: (tbRow.left as number) || 60,
        y: (tbRow.top as number) || 60,
        width: (tbRow.box_width as number) || 400,
        height: (tbRow.box_height as number) || 200,
        content: (tbRow.text as string) || '',
        fontFamily: 'Inter, sans-serif',
        fontSize: (tbRow.text_size as number) || 16,
        color: textColor,
        bold: false,
        italic: false,
        alignment: 'left',
        createdAt: (tbRow.creation_time as number) || creationTime,
        updatedAt: lastModTime,
      });
    }
    tbStmt.free();
  } catch {}

  sqlDb.close();

  // 8. Create Notebook Record
  const notebook: Notebook = {
    id: newNotebookId,
    title,
    coverColor: '#1d4ed8',
    coverPattern: 'marble',
    defaultTemplate: pages[0]?.template || DEFAULT_TEMPLATE,
    orientation: pages[0]?.orientation || 'portrait',
    importedFrom: 'notein',
    sourceFilename: sourceFilename || title,
    pageCount: pages.length,
    createdAt: creationTime,
    updatedAt: lastModTime,
  };

  // 9. Persist to Dexie
  await (db as any).db.transaction(
    'rw',
    (db as any).db.notebooks,
    (db as any).db.pages,
    (db as any).db.strokes,
    (db as any).db.textBoxes,
    async () => {
      await (db as any).db.notebooks.put(notebook);
      await (db as any).db.pages.bulkPut(pages);
      if (strokes.length > 0) {
        await (db as any).db.strokes.bulkPut(strokes);
      }
      if (textBoxes.length > 0) {
        await (db as any).db.textBoxes.bulkPut(textBoxes);
      }
    }
  );

  return {
    notebook,
    pages,
    initialPageId: pages[0].id,
  };
}

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
  let arrayBuffer: ArrayBuffer | null = null;
  let textContent: string | null = null;

  if (file instanceof File) {
    filename = file.name;
    arrayBuffer = await file.arrayBuffer();
  } else {
    filename = file.filename;
    if (typeof file.data === 'string') {
      if (file.data.startsWith('data:')) {
        const base64 = file.data.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        arrayBuffer = bytes.buffer;
      } else {
        textContent = file.data;
        arrayBuffer = new TextEncoder().encode(file.data).buffer;
      }
    } else {
      arrayBuffer = file.data;
    }
  }

  // 1. Magic byte inspection for binary file formats (ZIP, PDF, etc.)
  if (arrayBuffer && arrayBuffer.byteLength >= 4) {
    const bytes = new Uint8Array(arrayBuffer);

    // ZIP archive magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const hasNoteMeta = !!zip.file('note_meta.json');
        const hasDb = Object.keys(zip.files).some(
          (name) => name.startsWith('note_database_') && name.endsWith('_db')
        );

        if (hasNoteMeta || hasDb) {
          // Official NoteIn Android ZIP Package (from Android backup or Google Drive sync)
          return await importNoteinAndroidZip(arrayBuffer, filename, onProgress);
        }

        const packageJsonFile = zip.file('notein_package.json') || zip.file('notebook.json');
        if (packageJsonFile) {
          const jsonText = await packageJsonFile.async('string');
          return await importNoteinPackage(jsonText, filename);
        }
      } catch (err) {
        console.warn('ZIP check failed, proceeding to fallback checks:', err);
      }
    }

    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return await importPdfDocument(arrayBuffer, filename, onProgress);
    }
  }

  const lower = filename.toLowerCase();

  // 2. NoteIn Native Package (.notein, .in, or JSON backup)
  if (
    lower.endsWith('.notein') ||
    lower.endsWith('.in') ||
    (textContent && textContent.includes('"app":"NoteIn"'))
  ) {
    const jsonStr = textContent || (arrayBuffer ? new TextDecoder().decode(arrayBuffer) : '');
    return await importNoteinPackage(jsonStr, filename);
  }

  // 3. PDF Document fallback
  if (lower.endsWith('.pdf') && arrayBuffer) {
    return await importPdfDocument(arrayBuffer, filename, onProgress);
  }

  // 4. Image
  if (
    lower.match(/\.(png|jpe?g|webp|svg|gif|bmp)$/i) ||
    (typeof textContent === 'string' && textContent.startsWith('data:image/'))
  ) {
    let dataUrl = textContent || '';
    if (!dataUrl && arrayBuffer) {
      const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      dataUrl = `data:${mime};base64,${base64}`;
    }
    return await importImageDocument(dataUrl, filename);
  }

  // 5. Markdown or plain text
  const textStr = textContent || (arrayBuffer ? new TextDecoder().decode(arrayBuffer) : '');
  return await importMarkdownOrText(textStr, filename);
}

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
