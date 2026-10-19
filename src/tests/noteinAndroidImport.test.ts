import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { importAnyDocument, importNoteinAndroidZip } from '../services/documentImporter';
import * as db from '../db';

describe('NoteIn Android Google Drive Document Importer', () => {
  const sampleFilePath = '/home/ubuntu/Downloads/2 Flavour Neutrino Oscillation _1fFPWl_pbrSNpKL9z7Y6a2-0fkpD6iZyn';

  beforeEach(async () => {
    // Clear test tables
    await (db as any).db.notebooks.clear();
    await (db as any).db.pages.clear();
    await (db as any).db.strokes.clear();
    await (db as any).db.textBoxes.clear();
  });

  it('imports authentic NoteIn Android zip file with 6 pages and 2639 handwritten strokes', async () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const filename = path.basename(sampleFilePath);

    const result = await importNoteinAndroidZip(fileBuffer, filename);

    // 1. Verify Notebook
    expect(result.notebook).toBeDefined();
    expect(result.notebook.title).toBe('2 Flavour Neutrino Oscillation');
    expect(result.notebook.importedFrom).toBe('notein');
    expect(result.notebook.pageCount).toBe(6);

    // 2. Verify Pages
    expect(result.pages).toHaveLength(6);
    const firstPage = result.pages[0];
    expect(firstPage.width).toBe(1240);
    expect(firstPage.height).toBe(1754);
    expect(firstPage.orientation).toBe('portrait');
    expect(firstPage.template.bgColor).toBe('#ffeabd'); // Notein warm cream paper

    // 3. Verify Database Persistence
    const savedNotebook = await db.getNotebook(result.notebook.id);
    expect(savedNotebook).toBeDefined();
    expect(savedNotebook?.title).toBe('2 Flavour Neutrino Oscillation');

    const savedPages = await db.getPagesForNotebook(result.notebook.id);
    expect(savedPages).toHaveLength(6);

    // 4. Verify Strokes on Pages
    const page1Strokes = await db.getStrokesForPage(firstPage.id);
    expect(page1Strokes.length).toBe(527);

    // Verify stroke physics & pressure
    const sampleStroke = page1Strokes[0];
    expect(sampleStroke.points.length).toBeGreaterThan(0);
    expect(sampleStroke.points[0].pressure).toBeGreaterThan(0);
    expect(sampleStroke.color).toMatch(/^#[0-9a-f]{6}$/i);

    // Verify total strokes across all pages
    let totalStrokes = 0;
    for (const p of savedPages) {
      const pageStrokes = await db.getStrokesForPage(p.id);
      totalStrokes += pageStrokes.length;
    }
    expect(totalStrokes).toBe(2639);
  });

  it('auto-detects NoteIn Android package via universal importAnyDocument even with extensionless Google Drive filename', async () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

    const result = await importAnyDocument({
      data: arrayBuffer,
      filename: '2 Flavour Neutrino Oscillation _1fFPWl_pbrSNpKL9z7Y6a2-0fkpD6iZyn',
      mimeType: 'application/octet-stream',
    });

    expect(result.notebook.title).toBe('2 Flavour Neutrino Oscillation');
    expect(result.pages).toHaveLength(6);
    const strokes = await db.getStrokesForPage(result.pages[0].id);
    expect(strokes.length).toBe(527);
  });
});
