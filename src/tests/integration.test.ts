import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  db,
  createNotebook,
  createPage,
  saveStrokesForPage,
  getStrokesForPage,
  saveTextBoxesForPage,
  getTextBoxesForPage,
} from '../db';
import { HistoryManager } from '../engine/history';
import type { Stroke, TextBox } from '../types';

describe('NoteIn Full Studio Integration Lifecycle', () => {
  let history: HistoryManager;

  beforeEach(async () => {
    history = new HistoryManager(50);
    await db.textBoxes.clear();
    await db.strokes.clear();
    await db.pages.clear();
    await db.notebooks.clear();
  });

  it('handles multi-stroke drawing, eraser gesture grouping, and undo/redo', async () => {
    const { initialPage } = await createNotebook('Drawing & Eraser Test');

    let currentStrokes: Stroke[] = [];

    // 1. Draw 3 strokes
    const s1: Stroke = {
      id: 'stroke-1',
      pageId: initialPage.id,
      toolType: 'pen',
      color: '#000000',
      width: 3,
      opacity: 1,
      points: [{ x: 10, y: 10, pressure: 0.5 }],
      bounds: { minX: 8, minY: 8, maxX: 12, maxY: 12 },
      createdAt: 100,
    };
    currentStrokes = [...currentStrokes, s1];
    history.push({ type: 'ADD_STROKE', stroke: s1 });

    const s2: Stroke = {
      id: 'stroke-2',
      pageId: initialPage.id,
      toolType: 'highlighter',
      color: '#ffff00',
      width: 15,
      opacity: 0.4,
      points: [{ x: 50, y: 50, pressure: 0.5 }],
      bounds: { minX: 40, minY: 40, maxX: 60, maxY: 60 },
      createdAt: 200,
    };
    currentStrokes = [...currentStrokes, s2];
    history.push({ type: 'ADD_STROKE', stroke: s2 });

    const s3: Stroke = {
      id: 'stroke-3',
      pageId: initialPage.id,
      toolType: 'pen',
      color: '#1d4ed8',
      width: 2,
      opacity: 1,
      points: [{ x: 100, y: 100, pressure: 0.5 }],
      bounds: { minX: 98, minY: 98, maxX: 102, maxY: 102 },
      createdAt: 300,
    };
    currentStrokes = [...currentStrokes, s3];
    history.push({ type: 'ADD_STROKE', stroke: s3 });

    expect(currentStrokes).toHaveLength(3);
    expect(history.canUndo()).toBe(true);

    // Save to IndexedDB
    await saveStrokesForPage(initialPage.id, currentStrokes);
    expect(await getStrokesForPage(initialPage.id)).toHaveLength(3);

    // 2. Continuous eraser sweep: erases stroke-1 and stroke-2 in ONE gesture
    const deletedInGesture = [s1, s2];
    currentStrokes = currentStrokes.filter((s) => s.id !== 'stroke-1' && s.id !== 'stroke-2');
    history.push({ type: 'DELETE_STROKES', strokes: deletedInGesture });
    await saveStrokesForPage(initialPage.id, currentStrokes);

    expect(currentStrokes).toHaveLength(1);
    expect(currentStrokes[0].id).toBe('stroke-3');

    // 3. Undo eraser sweep -> restores both stroke-1 and stroke-2 in a single undo step!
    const undoEraserRes = history.undo(currentStrokes);
    currentStrokes = undoEraserRes.strokes;
    expect(currentStrokes).toHaveLength(3);
    await saveStrokesForPage(initialPage.id, currentStrokes);

    // Verify persisted state matches restored state
    const reloaded = await getStrokesForPage(initialPage.id);
    expect(reloaded).toHaveLength(3);

    // 4. Redo eraser sweep -> deletes them again
    const redoEraserRes = history.redo(currentStrokes);
    currentStrokes = redoEraserRes.strokes;
    expect(currentStrokes).toHaveLength(1);
    expect(currentStrokes[0].id).toBe('stroke-3');
  });

  it('handles text box creation, editing, moving, resizing, and persistence across refreshes', async () => {
    const { initialPage } = await createNotebook('Text Box Lifecycle');

    let currentTextBoxes: TextBox[] = [];

    // 1. Create text box
    const tb: TextBox = {
      id: 'tb-1',
      pageId: initialPage.id,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: 'Initial Idea',
      fontFamily: 'Inter',
      fontSize: 16,
      color: '#1c1917',
      bold: false,
      italic: false,
      alignment: 'left',
      createdAt: 100,
      updatedAt: 100,
    };
    currentTextBoxes = [...currentTextBoxes, tb];
    history.push({ type: 'ADD_TEXT_BOX', textBox: tb });
    await saveTextBoxesForPage(initialPage.id, currentTextBoxes);

    // 2. Edit text content & formatting
    const editedTb: TextBox = {
      ...tb,
      content: 'Refined Multiline\nInsight',
      bold: true,
      fontSize: 20,
      updatedAt: 200,
    };
    currentTextBoxes = [editedTb];
    history.push({ type: 'UPDATE_TEXT_BOX', prev: tb, current: editedTb });
    await saveTextBoxesForPage(initialPage.id, currentTextBoxes);

    // 3. Move text box
    const movedTb: TextBox = {
      ...editedTb,
      x: 250,
      y: 350,
      updatedAt: 300,
    };
    currentTextBoxes = [movedTb];
    history.push({ type: 'UPDATE_TEXT_BOX', prev: editedTb, current: movedTb });
    await saveTextBoxesForPage(initialPage.id, currentTextBoxes);

    // 4. Simulate browser refresh by loading clean from IndexedDB
    const refreshedBoxes = await getTextBoxesForPage(initialPage.id);
    expect(refreshedBoxes).toHaveLength(1);
    expect(refreshedBoxes[0].x).toBe(250);
    expect(refreshedBoxes[0].y).toBe(350);
    expect(refreshedBoxes[0].content).toBe('Refined Multiline\nInsight');
    expect(refreshedBoxes[0].bold).toBe(true);
    expect(refreshedBoxes[0].fontSize).toBe(20);

    // 5. Undo move
    const undoMoveRes = history.undo({ strokes: [], textBoxes: currentTextBoxes });
    currentTextBoxes = undoMoveRes.textBoxes;
    expect(currentTextBoxes[0].x).toBe(100);
    expect(currentTextBoxes[0].y).toBe(100);

    // 6. Undo edit
    const undoEditRes = history.undo({ strokes: [], textBoxes: currentTextBoxes });
    currentTextBoxes = undoEditRes.textBoxes;
    expect(currentTextBoxes[0].content).toBe('Initial Idea');
    expect(currentTextBoxes[0].bold).toBe(false);
    expect(currentTextBoxes[0].fontSize).toBe(16);

    // 7. Undo creation
    const undoCreateRes = history.undo({ strokes: [], textBoxes: currentTextBoxes });
    currentTextBoxes = undoCreateRes.textBoxes;
    expect(currentTextBoxes).toHaveLength(0);
    expect(history.canUndo()).toBe(false);
  });

  it('keeps page history isolated so actions do not leak across pages', async () => {
    const { notebook, initialPage } = await createNotebook('Multi-page Isolation');
    const page2 = await createPage(notebook.id);

    // Page 1 History
    const p1History = new HistoryManager();
    const p1Stroke: Stroke = {
      id: 'p1-stroke',
      pageId: initialPage.id,
      toolType: 'pen',
      color: '#000',
      width: 2,
      opacity: 1,
      points: [{ x: 10, y: 10, pressure: 0.5 }],
      bounds: { minX: 9, minY: 9, maxX: 11, maxY: 11 },
      createdAt: 100,
    };
    p1History.push({ type: 'ADD_STROKE', stroke: p1Stroke });
    expect(p1History.canUndo()).toBe(true);

    // Switching to Page 2 -> New/cleared history instance for page 2
    const p2History = new HistoryManager();
    expect(p2History.canUndo()).toBe(false); // Clean history on page 2!

    const p2Stroke: Stroke = {
      id: 'p2-stroke',
      pageId: page2.id,
      toolType: 'highlighter',
      color: '#ff0',
      width: 10,
      opacity: 0.5,
      points: [{ x: 50, y: 50, pressure: 0.5 }],
      bounds: { minX: 45, minY: 45, maxX: 55, maxY: 55 },
      createdAt: 200,
    };
    p2History.push({ type: 'ADD_STROKE', stroke: p2Stroke });

    // Undoing on page 2 affects ONLY page 2
    const undoP2 = p2History.undo([p2Stroke]);
    expect(undoP2.strokes).toHaveLength(0);

    // Page 1 history remains intact
    expect(p1History.canUndo()).toBe(true);
    const undoP1 = p1History.undo([p1Stroke]);
    expect(undoP1.strokes).toHaveLength(0);
  });
});
