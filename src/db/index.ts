import Dexie, { type EntityTable } from 'dexie';
import type { Folder, Notebook, Page, Stroke, TextBox, PaperTemplate, PageOrientation } from '../types';

export const DEFAULT_A4_WIDTH = 794;
export const DEFAULT_A4_HEIGHT = 1123;

export function getPageDimensions(orientation: PageOrientation = 'portrait'): { width: number; height: number } {
  if (orientation === 'landscape') {
    return { width: DEFAULT_A4_HEIGHT, height: DEFAULT_A4_WIDTH };
  }
  return { width: DEFAULT_A4_WIDTH, height: DEFAULT_A4_HEIGHT };
}

export const DEFAULT_TEMPLATE: PaperTemplate = {
  type: 'ruled',
  lineSpacing: 28,
  gridSize: 20,
  patternColor: '#dbeafe',
  bgColor: '#ffffff',
};

export class NoteinDatabase extends Dexie {
  notebooks!: EntityTable<Notebook, 'id'>;
  pages!: EntityTable<Page, 'id'>;
  strokes!: EntityTable<Stroke, 'id'>;
  textBoxes!: EntityTable<TextBox, 'id'>;
  folders!: EntityTable<Folder, 'id'>;

  constructor() {
    super('NoteinDatabase');
    this.version(1).stores({
      notebooks: '&id, title, createdAt, updatedAt',
      pages: '&id, notebookId, pageNumber, createdAt, updatedAt',
      strokes: '&id, pageId, createdAt',
    });
    this.version(2).stores({
      textBoxes: '&id, pageId, createdAt, updatedAt',
    });
    this.version(3).stores({
      folders: '&id, name, parentId, createdAt, updatedAt',
      notebooks: '&id, title, folderId, createdAt, updatedAt',
    });
  }
}

export const db = new NoteinDatabase();

// --- Notebook Operations ---

export async function getNotebooks(): Promise<Notebook[]> {
  try {
    return await db.notebooks.orderBy('updatedAt').reverse().toArray();
  } catch (error) {
    console.error('Failed to load notebooks:', error);
    return [];
  }
}

export async function getNotebook(id: string): Promise<Notebook | undefined> {
  return await db.notebooks.get(id);
}

export async function createNotebook(
  title: string,
  coverColor: string = '#1d4ed8',
  coverPattern: Notebook['coverPattern'] = 'solid',
  template: PaperTemplate = DEFAULT_TEMPLATE,
  orientation: PageOrientation = 'portrait',
  folderId?: string | null
): Promise<{ notebook: Notebook; initialPage: Page }> {
  const now = Date.now();
  const notebookId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  const dims = getPageDimensions(orientation);

  const notebook: Notebook = {
    id: notebookId,
    title: title.trim() || 'Untitled Notebook',
    coverColor,
    coverPattern,
    defaultTemplate: template,
    orientation,
    createdAt: now,
    updatedAt: now,
    pageCount: 1,
    ...(folderId ? { folderId } : {}),
  };

  const initialPage: Page = {
    id: pageId,
    notebookId,
    pageNumber: 1,
    title: 'Page 1',
    template,
    width: dims.width,
    height: dims.height,
    orientation,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.notebooks.add(notebook);
    await db.pages.add(initialPage);
  });

  return { notebook, initialPage };
}

export async function updateNotebookTitle(id: string, title: string): Promise<void> {
  await db.notebooks.update(id, {
    title: title.trim() || 'Untitled Notebook',
    updatedAt: Date.now(),
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  await db.transaction('rw', db.notebooks, db.pages, db.strokes, db.textBoxes, async () => {
    const pages = await db.pages.where('notebookId').equals(id).toArray();
    const pageIds = pages.map((p) => p.id);

    await db.textBoxes.where('pageId').anyOf(pageIds).delete();
    await db.strokes.where('pageId').anyOf(pageIds).delete();
    await db.pages.where('notebookId').equals(id).delete();
    await db.notebooks.delete(id);
  });
}

// --- Page Operations ---

export async function getPagesForNotebook(notebookId: string): Promise<Page[]> {
  return await db.pages
    .where('notebookId')
    .equals(notebookId)
    .sortBy('pageNumber');
}

export async function getPage(id: string): Promise<Page | undefined> {
  return await db.pages.get(id);
}

export async function createPage(
  notebookId: string,
  template?: PaperTemplate,
  orientation?: PageOrientation
): Promise<Page> {
  const now = Date.now();
  const existingPages = await getPagesForNotebook(notebookId);
  const nextNumber = existingPages.length + 1;
  const notebook = await getNotebook(notebookId);

  const targetOrientation =
    orientation ||
    (existingPages.length > 0 ? existingPages[existingPages.length - 1].orientation : notebook?.orientation) ||
    'portrait';

  const dims = getPageDimensions(targetOrientation);

  const page: Page = {
    id: crypto.randomUUID(),
    notebookId,
    pageNumber: nextNumber,
    title: `Page ${nextNumber}`,
    template: template || notebook?.defaultTemplate || DEFAULT_TEMPLATE,
    width: dims.width,
    height: dims.height,
    orientation: targetOrientation,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.pages.add(page);
    await db.notebooks.update(notebookId, {
      pageCount: nextNumber,
      updatedAt: now,
    });
  });

  return page;
}

export async function updatePageOrientation(
  pageId: string,
  orientation: PageOrientation
): Promise<Page | undefined> {
  const page = await db.pages.get(pageId);
  if (!page) return undefined;

  const dims = getPageDimensions(orientation);
  const now = Date.now();

  await db.pages.update(pageId, {
    orientation,
    width: dims.width,
    height: dims.height,
    updatedAt: now,
  });

  return await db.pages.get(pageId);
}

export async function duplicatePage(pageId: string): Promise<Page | undefined> {
  const sourcePage = await getPage(pageId);
  if (!sourcePage) return undefined;

  const now = Date.now();
  const existingPages = await getPagesForNotebook(sourcePage.notebookId);
  const newPageId = crypto.randomUUID();
  const targetNumber = sourcePage.pageNumber + 1;

  await db.transaction('rw', db.notebooks, db.pages, db.strokes, db.textBoxes, async () => {
    for (const p of existingPages) {
      if (p.pageNumber >= targetNumber) {
        await db.pages.update(p.id, { pageNumber: p.pageNumber + 1 });
      }
    }

    const newPage: Page = {
      ...sourcePage,
      id: newPageId,
      pageNumber: targetNumber,
      title: `${sourcePage.title} (Copy)`,
      orientation: sourcePage.orientation || 'portrait',
      width: sourcePage.width,
      height: sourcePage.height,
      createdAt: now,
      updatedAt: now,
    };

    await db.pages.add(newPage);

    // Duplicate all strokes on source page
    const sourceStrokes = await db.strokes.where('pageId').equals(pageId).toArray();
    const clonedStrokes: Stroke[] = sourceStrokes.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      pageId: newPageId,
      createdAt: now,
    }));

    if (clonedStrokes.length > 0) {
      await db.strokes.bulkAdd(clonedStrokes);
    }

    // Duplicate all text boxes on source page
    const sourceTextBoxes = await db.textBoxes.where('pageId').equals(pageId).toArray();
    const clonedTextBoxes: TextBox[] = sourceTextBoxes.map((tb) => ({
      ...tb,
      id: crypto.randomUUID(),
      pageId: newPageId,
      createdAt: now,
      updatedAt: now,
    }));

    if (clonedTextBoxes.length > 0) {
      await db.textBoxes.bulkAdd(clonedTextBoxes);
    }

    await db.notebooks.update(sourcePage.notebookId, {
      pageCount: existingPages.length + 1,
      updatedAt: now,
    });
  });

  return await getPage(newPageId);
}

export async function deletePage(pageId: string): Promise<boolean> {
  const targetPage = await getPage(pageId);
  if (!targetPage) return false;

  const notebookId = targetPage.notebookId;
  const existingPages = await getPagesForNotebook(notebookId);

  // Prevent deleting the sole remaining page
  if (existingPages.length <= 1) {
    return false;
  }

  await db.transaction('rw', db.notebooks, db.pages, db.strokes, db.textBoxes, async () => {
    await db.textBoxes.where('pageId').equals(pageId).delete();
    await db.strokes.where('pageId').equals(pageId).delete();
    await db.pages.delete(pageId);

    // Re-index remaining pages
    const remaining = existingPages.filter((p) => p.id !== pageId);
    for (let i = 0; i < remaining.length; i++) {
      await db.pages.update(remaining[i].id, { pageNumber: i + 1 });
    }

    await db.notebooks.update(notebookId, {
      pageCount: remaining.length,
      updatedAt: Date.now(),
    });
  });

  return true;
}

export async function updatePageTemplate(
  pageId: string,
  template: PaperTemplate
): Promise<void> {
  await db.pages.update(pageId, {
    template,
    updatedAt: Date.now(),
  });
}

// --- Stroke Operations ---

export async function getStrokesForPage(pageId: string): Promise<Stroke[]> {
  try {
    return await db.strokes.where('pageId').equals(pageId).sortBy('createdAt');
  } catch (error) {
    console.error('Failed to get strokes:', error);
    return [];
  }
}

export async function saveStrokesForPage(
  pageId: string,
  strokes: Stroke[]
): Promise<void> {
  await db.transaction('rw', db.strokes, db.pages, db.notebooks, async () => {
    await db.strokes.where('pageId').equals(pageId).delete();
    if (strokes.length > 0) {
      await db.strokes.bulkAdd(strokes);
    }
    const page = await db.pages.get(pageId);
    if (page) {
      const now = Date.now();
      await db.pages.update(pageId, { updatedAt: now });
      await db.notebooks.update(page.notebookId, { updatedAt: now });
    }
  });
}

// --- Text Box Operations ---

export async function getTextBoxesForPage(pageId: string): Promise<TextBox[]> {
  try {
    return await db.textBoxes.where('pageId').equals(pageId).sortBy('createdAt');
  } catch (error) {
    console.error('Failed to get text boxes:', error);
    return [];
  }
}

export async function saveTextBoxesForPage(
  pageId: string,
  textBoxes: TextBox[]
): Promise<void> {
  await db.transaction('rw', db.textBoxes, db.pages, db.notebooks, async () => {
    await db.textBoxes.where('pageId').equals(pageId).delete();
    if (textBoxes.length > 0) {
      await db.textBoxes.bulkAdd(textBoxes);
    }
    const page = await db.pages.get(pageId);
    if (page) {
      const now = Date.now();
      await db.pages.update(pageId, { updatedAt: now });
      await db.notebooks.update(page.notebookId, { updatedAt: now });
    }
  });
}

// --- Initial Seed Helper ---

export async function initDefaultData(): Promise<void> {
  const count = await db.notebooks.count();
  if (count > 0) return;

  const { initialPage } = await createNotebook(
    'Getting Started with NoteIn',
    '#1d4ed8',
    'marble',
    {
      type: 'ruled',
      lineSpacing: 28,
      gridSize: 20,
      patternColor: '#bfdbfe',
      bgColor: '#ffffff',
    },
    'portrait'
  );

  // Add welcome sample vector strokes
  const welcomeStrokes: Stroke[] = [
    {
      id: crypto.randomUUID(),
      pageId: initialPage.id,
      toolType: 'pen',
      penStyle: 'fountain',
      color: '#1e3a8a',
      width: 4.5,
      opacity: 1.0,
      points: [
        { x: 120, y: 160, pressure: 0.5 },
        { x: 125, y: 162, pressure: 0.65 },
        { x: 135, y: 165, pressure: 0.8 },
        { x: 155, y: 166, pressure: 0.7 },
        { x: 175, y: 164, pressure: 0.5 },
      ],
      bounds: { minX: 118, minY: 158, maxX: 177, maxY: 168 },
      createdAt: Date.now() - 5000,
    },
    {
      id: crypto.randomUUID(),
      pageId: initialPage.id,
      toolType: 'highlighter',
      color: '#facc15',
      width: 18,
      opacity: 0.35,
      points: [
        { x: 110, y: 163, pressure: 0.5 },
        { x: 260, y: 163, pressure: 0.5 },
      ],
      bounds: { minX: 100, minY: 150, maxX: 270, maxY: 175 },
      createdAt: Date.now() - 4000,
    },
  ];

  await db.strokes.bulkAdd(welcomeStrokes);

  // Add a sample welcome text box
  const welcomeTextBox: TextBox = {
    id: crypto.randomUUID(),
    pageId: initialPage.id,
    x: 120,
    y: 200,
    width: 450,
    height: 80,
    content: 'Welcome to NoteIn Web!\nUse the Pen, Highlighter, Eraser, or click the Text tool to type anywhere.',
    fontFamily: 'Inter, sans-serif',
    fontSize: 16,
    color: '#1e293b',
    bold: false,
    italic: false,
    alignment: 'left',
    createdAt: Date.now() - 3000,
    updatedAt: Date.now() - 3000,
  };

  await db.textBoxes.add(welcomeTextBox);
}


// --- Folder Operations (Matching NoteIn APK) ---

export async function getFolders(): Promise<Folder[]> {
  try {
    return await db.folders.orderBy('createdAt').toArray();
  } catch (error) {
    console.error('Failed to get folders:', error);
    return [];
  }
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return await db.folders.get(id);
}

export async function createFolder(
  name: string,
  color: string = '#4E5262',
  colorName: string = 'Default',
  parentId: string | null = null
): Promise<Folder> {
  const now = Date.now();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    colorName,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  await db.folders.add(folder);
  return folder;
}

export async function updateFolder(
  id: string,
  updates: Partial<Folder>
): Promise<Folder | undefined> {
  await db.folders.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
  return await db.folders.get(id);
}

export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.folders, db.notebooks, async () => {
    // Unassign notebooks in this folder to root/desktop
    const nbsInFolder = await db.notebooks.filter((nb) => nb.folderId === id).toArray();
    for (const nb of nbsInFolder) {
      await db.notebooks.update(nb.id, { folderId: null, updatedAt: Date.now() });
    }
    // Delete subfolders or move them to parent
    const subfolders = await db.folders.filter((f) => f.parentId === id).toArray();
    for (const sub of subfolders) {
      await db.folders.update(sub.id, { parentId: null, updatedAt: Date.now() });
    }
    await db.folders.delete(id);
  });
}

export async function moveNotebookToFolder(
  notebookId: string,
  folderId: string | null
): Promise<void> {
  await db.notebooks.update(notebookId, {
    folderId,
    updatedAt: Date.now(),
  });
}
