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
  saveStrokesForPage,
  getStrokesForPage,
} from '../db';
import type { Stroke } from '../types';

describe('IndexedDB Persistence (Dexie Storage Layer)', () => {
  beforeEach(async () => {
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

    it('cascades deletion across pages and strokes', async () => {
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

      // Verify stroke exists before delete
      const beforeStrokes = await getStrokesForPage(initialPage.id);
      expect(beforeStrokes).toHaveLength(1);

      // Delete notebook
      await deleteNotebook(notebook.id);

      // Verify notebook, page, and stroke are all gone
      const n = await getNotebook(notebook.id);
      expect(n).toBeUndefined();

      const pages = await getPagesForNotebook(notebook.id);
      expect(pages).toHaveLength(0);

      const afterStrokes = await getStrokesForPage(initialPage.id);
      expect(afterStrokes).toHaveLength(0);
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

    it('duplicates a page and its vector strokes, shifting subsequent pages', async () => {
      const { notebook, initialPage } = await createNotebook('Duplication Test');
      await createPage(notebook.id); // Page 2

      // Add a stroke to page 1
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
      expect(dupStrokes[0].color).toBe('#ff0000');

      // Check total page ordering
      const allPages = await getPagesForNotebook(notebook.id);
      expect(allPages).toHaveLength(3);
      expect(allPages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    });

    it('deletes a page, removes strokes, and re-indexes remaining pages', async () => {
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

  describe('Vector Stroke Persistence', () => {
    it('saves and restores stroke vectors with pressure data', async () => {
      const { initialPage } = await createNotebook('Stroke Test');

      const stroke1: Stroke = {
        id: 'stroke-1',
        pageId: initialPage.id,
        toolType: 'pen',
        penStyle: 'fountain',
        color: '#10b981',
        width: 3.5,
        opacity: 1,
        points: [
          { x: 10, y: 10, pressure: 0.2 },
          { x: 20, y: 25, pressure: 0.8 },
        ],
        bounds: { minX: 8, minY: 8, maxX: 22, maxY: 27 },
        createdAt: 100,
      };

      const stroke2: Stroke = {
        id: 'stroke-2',
        pageId: initialPage.id,
        toolType: 'highlighter',
        color: '#fef08a',
        width: 20,
        opacity: 0.4,
        points: [
          { x: 100, y: 100, pressure: 0.5 },
          { x: 200, y: 100, pressure: 0.5 },
        ],
        bounds: { minX: 90, minY: 90, maxX: 210, maxY: 110 },
        createdAt: 200,
      };

      await saveStrokesForPage(initialPage.id, [stroke1, stroke2]);

      const loaded = await getStrokesForPage(initialPage.id);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('stroke-1');
      expect(loaded[0].points[1].pressure).toBe(0.8);
      expect(loaded[1].toolType).toBe('highlighter');
      expect(loaded[1].opacity).toBe(0.4);
    });
  });
});
