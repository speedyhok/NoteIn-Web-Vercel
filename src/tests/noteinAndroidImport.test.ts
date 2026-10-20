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
    await (db as any).db.noteImages.clear();
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
  it('extracts embedded images from NoteIn Android zip and persists to noteImages', async () => {
    const JSZip = (await import('jszip')).default;
    const { getSql } = await import('../services/sqlHelper');

    // Create a mock SQLite database with PageEntity and ImageEntity
    const SQL = await getSql();
    const testDb = new SQL.Database();
    testDb.run(`
      CREATE TABLE NoteContentEntity (id TEXT PRIMARY KEY, page_list TEXT, default_page_id TEXT, creation_time INTEGER, last_modification_time INTEGER);
      CREATE TABLE PageEntity (id TEXT PRIMARY KEY, note_id TEXT, paper_spec TEXT, page_orientation TEXT, paper_theme TEXT, creation_time INTEGER);
      CREATE TABLE ImageEntity (id TEXT PRIMARY KEY, page_id TEXT, uri TEXT, bounds TEXT, rotation REAL, "left" REAL, "top" REAL, "right" REAL, "bottom" REAL, creation_time INTEGER, last_modification_time INTEGER, layer INTEGER, layer_id TEXT, fixed INTEGER);
    `);

    const pageId1 = 'page-test-uuid-1';
    testDb.run(
      "INSERT INTO NoteContentEntity VALUES ('note-1', ?, 'page-test-uuid-1', 1700000000000, 1700000000000)",
      [JSON.stringify([pageId1])]
    );
    testDb.run(
      "INSERT INTO PageEntity VALUES (?, ?, ?, ?, ?, ?)",
      ['page-test-uuid-1', 'note-1', JSON.stringify({ width: 1240, height: 1754 }), 'VERTICAL', null, 1700000000000]
    );

    // Insert an ImageEntity
    testDb.run(
      "INSERT INTO ImageEntity VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['img-uuid-1', 'page-test-uuid-1', '/storage/emulated/0/diagram.png', JSON.stringify({ left: 120, top: 180, right: 620, bottom: 580 }), 0, 120, 180, 620, 580, 1700000000000, 1700000000000, 0, 'default', 0]
    );

    const dbBytes = testDb.export();
    testDb.close();

    // Create mock ZIP with NoteIn structure
    const zip = new JSZip();
    zip.file('note_meta.json', JSON.stringify({ title: 'Physics Diagrams Note' }));
    zip.file('note_database_test_db', dbBytes);

    // 1x1 transparent PNG bytes
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    zip.file('note_image_diagram.png', pngBytes);

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
    const result = await importNoteinAndroidZip(zipBuffer, 'Physics Diagrams Note.notein');

    expect(result.notebook.title).toBe('Physics Diagrams Note');
    expect(result.pages).toHaveLength(1);
    expect(result.images).toHaveLength(1);

    const importedImg = result.images![0];
    expect(importedImg.x).toBe(120);
    expect(importedImg.y).toBe(180);
    expect(importedImg.width).toBe(500);
    expect(importedImg.height).toBe(400);
    expect(importedImg.src).toContain('data:image/png;base64,');

    // Verify persistence in IndexedDB
    const savedImages = await db.getImagesForPage(result.pages[0].id);
    expect(savedImages).toHaveLength(1);
    expect(savedImages[0].src).toBe(importedImg.src);
    expect(savedImages[0].width).toBe(500);
  });

});
