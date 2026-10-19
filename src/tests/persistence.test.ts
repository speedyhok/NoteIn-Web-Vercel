import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  db,
  createNotebook,
  getNotebooks,
  getNotebook,
  updateNotebookTitle,
  deleteNotebook,
  createPage,
  getPagesForNotebook,
  getPage,
  duplicatePage,
  deletePage,
  updatePageTemplate,
  updatePageOrientation,
  DEFAULT_TEMPLATE,
  saveStrokesForPage,
  getStrokesForPage,
  saveTextBoxesForPage,
  getTextBoxesForPage,
  initDefaultData,
} from '../db';
import type { Stroke, TextBox } from '../types';

describe('IndexedDB Persistence (Dexie Storage Layer)', () => {
  beforeEach(async () => {
    await db.textBoxes.clear();
    await db.strokes.clear();
    await db.pages.clear();
    await db.notebooks.clear();
  });

  describe('Notebook CRUD', () => {
    it('creates a notebook with an initial page', async () => {
      const { notebook, initialPage } = await createNotebook('Physics Notes', '#3b82f6', 'marble');

      expect(notebook.id).toBeDefined();
      expect(notebook.title).toBe('Physics Notes');
      expect(notebook.coverColor).toBe('#3b82f6');
      expect(notebook.coverPattern).toBe('marble');
      expect(notebook.pageCount).toBe(1);

      expect(initialPage.id).toBeDefined();
      expect(initialPage.notebookId).toBe(notebook.id);
      expect(initialPage.pageNumber).toBe(1);

      const allNotebooks = await getNotebooks();
      expect(allNotebooks).toHaveLength(1);
      expect(allNotebooks[0].title).toBe('Physics Notes');
    });

    it('renames a notebook', async () => {
      const { notebook } = await createNotebook('Old Name');
      await updateNotebookTitle(notebook.id, 'New Name');

      const updated = await getNotebook(notebook.id);
      expect(updated?.title).toBe('New Name');
    });

    it('cascades deletion across pages, strokes, and text boxes', async () => {
      const { notebook, initialPage } = await createNotebook('To Delete');

      const stroke: Stroke = {
        id: 's-cascade',
        pageId: initialPage.id,
        toolType: 'pen',
        color: '#000',
        width: 2,
        opacity: 1,
        points: [{ x: 1, y: 1, pressure: 0.5 }],
        bounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
        createdAt: Date.now(),
      };
      await saveStrokesForPage(initialPage.id, [stroke]);

      const textBox: TextBox = {
        id: 'tb-cascade',
        pageId: initialPage.id,
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        content: 'Cascading deletion note',
        fontFamily: 'Inter',
        fontSize: 14,
        color: '#000',
        bold: false,
        italic: false,
        alignment: 'left',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveTextBoxesForPage(initialPage.id, [textBox]);

      // Verify records exist before delete
      expect(await getStrokesForPage(initialPage.id)).toHaveLength(1);
      expect(await getTextBoxesForPage(initialPage.id)).toHaveLength(1);

      // Delete notebook
      await deleteNotebook(notebook.id);

      // Verify all related records are purged
      expect(await getNotebook(notebook.id)).toBeUndefined();
      expect(await getPagesForNotebook(notebook.id)).toHaveLength(0);
      expect(await getStrokesForPage(initialPage.id)).toHaveLength(0);
      expect(await getTextBoxesForPage(initialPage.id)).toHaveLength(0);
    });
  });

  describe('Page Management', () => {
    it('creates additional pages and maintains numbering', async () => {
      const { notebook } = await createNotebook('Multi-page Book');

      const page2 = await createPage(notebook.id);
      const page3 = await createPage(notebook.id);

      expect(page2.pageNumber).toBe(2);
      expect(page3.pageNumber).toBe(3);

      const pages = await getPagesForNotebook(notebook.id);
      expect(pages).toHaveLength(3);
      expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);

      const updatedNotebook = await getNotebook(notebook.id);
      expect(updatedNotebook?.pageCount).toBe(3);
    });

    it('duplicates a page, vector strokes, and text boxes with distinct IDs', async () => {
      const { notebook, initialPage } = await createNotebook('Duplication Test');
      await createPage(notebook.id); // Page 2

      // Add a stroke and a text box to page 1
      const stroke: Stroke = {
        id: 's-orig',
        pageId: initialPage.id,
        toolType: 'pen',
        color: '#ff0000',
        width: 3,
        opacity: 1,
        points: [{ x: 50, y: 50, pressure: 0.5 }],
        bounds: { minX: 48, minY: 48, maxX: 52, maxY: 52 },
        createdAt: 100,
      };
      await saveStrokesForPage(initialPage.id, [stroke]);

      const textBox: TextBox = {
        id: 'tb-orig',
        pageId: initialPage.id,
        x: 60,
        y: 60,
        width: 150,
        height: 50,
        content: 'Original Note',
        fontFamily: 'Inter',
        fontSize: 16,
        color: '#000000',
        bold: true,
        italic: false,
        alignment: 'left',
        createdAt: 100,
        updatedAt: 100,
      };
      await saveTextBoxesForPage(initialPage.id, [textBox]);

      // Duplicate page 1 -> creates new page at pageNumber 2
      const dupPage = await duplicatePage(initialPage.id);
      expect(dupPage).toBeDefined();
      expect(dupPage!.pageNumber).toBe(2);
      expect(dupPage!.title).toContain('(Copy)');

      // Verify strokes were cloned to new page with distinct ID
      const dupStrokes = await getStrokesForPage(dupPage!.id);
      expect(dupStrokes).toHaveLength(1);
      expect(dupStrokes[0].id).not.toBe('s-orig');
      expect(dupStrokes[0].pageId).toBe(dupPage!.id);

      // Verify text boxes were cloned to new page with distinct ID
      const dupTextBoxes = await getTextBoxesForPage(dupPage!.id);
      expect(dupTextBoxes).toHaveLength(1);
      expect(dupTextBoxes[0].id).not.toBe('tb-orig');
      expect(dupTextBoxes[0].pageId).toBe(dupPage!.id);
      expect(dupTextBoxes[0].content).toBe('Original Note');
      expect(dupTextBoxes[0].bold).toBe(true);
    });

    it('deletes a page, removes strokes/text boxes, and re-indexes remaining pages', async () => {
      const { notebook, initialPage } = await createNotebook('Delete Page Test');
      const page2 = await createPage(notebook.id);
      const page3 = await createPage(notebook.id);

      // Delete page 2
      const deleted = await deletePage(page2.id);
      expect(deleted).toBe(true);

      const remaining = await getPagesForNotebook(notebook.id);
      expect(remaining).toHaveLength(2);
      expect(remaining.map((p) => p.pageNumber)).toEqual([1, 2]);
      expect(remaining.map((p) => p.id)).toEqual([initialPage.id, page3.id]);
    });

    it('prevents deleting the sole remaining page in a notebook', async () => {
      const { initialPage } = await createNotebook('Single Page');
      const deleted = await deletePage(initialPage.id);
      expect(deleted).toBe(false);

      const page = await getPage(initialPage.id);
      expect(page).toBeDefined();
    });

    it('updates paper template', async () => {
      const { initialPage } = await createNotebook('Template Change');
      await updatePageTemplate(initialPage.id, {
        type: 'grid',
        lineSpacing: 28,
        gridSize: 25,
        patternColor: '#a7f3d0',
        bgColor: '#ffffff',
      });

      const updated = await getPage(initialPage.id);
      expect(updated?.template.type).toBe('grid');
      expect(updated?.template.gridSize).toBe(25);
    });
  });

  
  describe('Page Orientation and Landscape Mode', () => {
    it('creates a notebook in landscape mode with inverted dimensions', async () => {
      const { notebook, initialPage } = await createNotebook('Landscape Notebook', '#1d4ed8', 'solid', DEFAULT_TEMPLATE, 'landscape');
      expect(notebook.orientation).toBe('landscape');
      expect(initialPage.orientation).toBe('landscape');
      expect(initialPage.width).toBe(1123);
      expect(initialPage.height).toBe(794);
    });

    it('toggles page orientation between portrait and landscape dynamically', async () => {
      const { initialPage } = await createNotebook('Orientation Switcher');
      expect(initialPage.orientation).toBe('portrait');
      expect(initialPage.width).toBe(794);
      expect(initialPage.height).toBe(1123);

      // Switch to landscape
      const landscapePage = await updatePageOrientation(initialPage.id, 'landscape');
      expect(landscapePage?.orientation).toBe('landscape');
      expect(landscapePage?.width).toBe(1123);
      expect(landscapePage?.height).toBe(794);

      // Verify DB persistence
      const fetchedPage = await getPage(initialPage.id);
      expect(fetchedPage?.orientation).toBe('landscape');
      expect(fetchedPage?.width).toBe(1123);
      expect(fetchedPage?.height).toBe(794);

      // Switch back to portrait
      const portraitPage = await updatePageOrientation(initialPage.id, 'portrait');
      expect(portraitPage?.orientation).toBe('portrait');
      expect(portraitPage?.width).toBe(794);
      expect(portraitPage?.height).toBe(1123);
    });
  });

  describe('Text Box Persistence', () => {
    it('saves and retrieves text boxes with all formatting fields', async () => {
      const { initialPage } = await createNotebook('Text Notebook');

      const tb1: TextBox = {
        id: 'tb-1',
        pageId: initialPage.id,
        x: 40,
        y: 80,
        width: 300,
        height: 60,
        content: 'Multiline\nText Note with formatting',
        fontFamily: 'Georgia, serif',
        fontSize: 20,
        color: '#1d4ed8',
        bold: true,
        italic: true,
        alignment: 'center',
        createdAt: 500,
        updatedAt: 600,
      };

      await saveTextBoxesForPage(initialPage.id, [tb1]);

      const loaded = await getTextBoxesForPage(initialPage.id);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].content).toBe('Multiline\nText Note with formatting');
      expect(loaded[0].fontFamily).toBe('Georgia, serif');
      expect(loaded[0].fontSize).toBe(20);
      expect(loaded[0].color).toBe('#1d4ed8');
      expect(loaded[0].bold).toBe(true);
      expect(loaded[0].italic).toBe(true);
      expect(loaded[0].alignment).toBe('center');
    });

    
    it('persists advanced text formatting (underline, strikethrough, background cards, lists)', async () => {
      const { initialPage } = await createNotebook('Advanced Text Test');

      const advancedBox: TextBox = {
        id: 'tb-adv-1',
        pageId: initialPage.id,
        x: 50,
        y: 100,
        width: 280,
        height: 120,
        content: '• Key note item\n• Action checklist',
        fontFamily: 'Inter',
        fontSize: 16,
        color: '#1e293b',
        bold: true,
        italic: false,
        underline: true,
        strikethrough: false,
        alignment: 'justify',
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        isBulletList: true,
        isNumberedList: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveTextBoxesForPage(initialPage.id, [advancedBox]);
      const loaded = await getTextBoxesForPage(initialPage.id);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].underline).toBe(true);
      expect(loaded[0].strikethrough).toBe(false);
      expect(loaded[0].backgroundColor).toBe('#fef3c7');
      expect(loaded[0].borderColor).toBe('#f59e0b');
      expect(loaded[0].isBulletList).toBe(true);
      expect(loaded[0].alignment).toBe('justify');
    });

    it('initializes default welcome data with both vector strokes and text box', async () => {
      await initDefaultData();

      const notebooks = await getNotebooks();
      expect(notebooks.length).toBeGreaterThan(0);

      const pages = await getPagesForNotebook(notebooks[0].id);
      expect(pages.length).toBeGreaterThan(0);

      const strokes = await getStrokesForPage(pages[0].id);
      expect(strokes.length).toBeGreaterThan(0);

      const textBoxes = await getTextBoxesForPage(pages[0].id);
      expect(textBoxes.length).toBeGreaterThan(0);
      expect(textBoxes[0].content).toContain('Welcome to NoteIn Web');
    });
  });
});
