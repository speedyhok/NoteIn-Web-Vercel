import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryManager } from '../engine/history';
import type { Stroke, TextBox } from '../types';

describe('HistoryManager (Undo / Redo Engine)', () => {
  let manager: HistoryManager;

  const mockStroke1: Stroke = {
    id: 's1',
    pageId: 'p1',
    toolType: 'pen',
    color: '#000000',
    width: 2,
    opacity: 1,
    points: [{ x: 10, y: 10, pressure: 0.5 }],
    bounds: { minX: 9, minY: 9, maxX: 11, maxY: 11 },
    createdAt: 1000,
  };

  const mockStroke2: Stroke = {
    id: 's2',
    pageId: 'p1',
    toolType: 'pen',
    color: '#ff0000',
    width: 4,
    opacity: 1,
    points: [{ x: 20, y: 20, pressure: 0.5 }],
    bounds: { minX: 18, minY: 18, maxX: 22, maxY: 22 },
    createdAt: 2000,
  };

  const mockTextBox1: TextBox = {
    id: 'tb1',
    pageId: 'p1',
    x: 100,
    y: 100,
    width: 200,
    height: 50,
    content: 'Hello World',
    fontFamily: 'Inter',
    fontSize: 16,
    color: '#000000',
    bold: false,
    italic: false,
    alignment: 'left',
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    manager = new HistoryManager(10);
  });

  it('starts with empty undo and redo stacks', () => {
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
  });

  it('notifies subscribers reactively when state changes', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);

    // Initial call on subscribe
    expect(listener).toHaveBeenCalledWith(false, false);

    // Push action
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });
    expect(listener).toHaveBeenCalledWith(true, false);

    // Undo
    manager.undo([mockStroke1]);
    expect(listener).toHaveBeenCalledWith(false, true);

    // Redo
    manager.redo([]);
    expect(listener).toHaveBeenCalledWith(true, false);

    unsub();
  });

  it('handles undo and redo for ADD_STROKE', () => {
    let strokes: Stroke[] = [];

    strokes.push(mockStroke1);
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });

    expect(manager.canUndo()).toBe(true);

    const undoRes = manager.undo(strokes);
    expect(undoRes.strokes).toHaveLength(0);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    const redoRes = manager.redo(undoRes.strokes);
    expect(redoRes.strokes).toHaveLength(1);
    expect(redoRes.strokes[0].id).toBe('s1');
  });

  it('handles undo and redo for DELETE_STROKES (continuous eraser gesture)', () => {
    let strokes: Stroke[] = [mockStroke1, mockStroke2];

    strokes = [];
    manager.push({ type: 'DELETE_STROKES', strokes: [mockStroke1, mockStroke2] });

    const undoRes = manager.undo(strokes);
    expect(undoRes.strokes).toHaveLength(2);

    const redoRes = manager.redo(undoRes.strokes);
    expect(redoRes.strokes).toHaveLength(0);
  });

  it('handles undo and redo for ADD_TEXT_BOX', () => {
    const initialState = {
      strokes: [mockStroke1],
      textBoxes: [mockTextBox1],
    };

    manager.push({ type: 'ADD_TEXT_BOX', textBox: mockTextBox1 });

    const undoRes = manager.undo(initialState);
    expect(undoRes.textBoxes).toHaveLength(0);
    expect(undoRes.strokes).toHaveLength(1); // Strokes remain untouched

    const redoRes = manager.redo(undoRes);
    expect(redoRes.textBoxes).toHaveLength(1);
    expect(redoRes.textBoxes[0].content).toBe('Hello World');
  });

  it('handles undo and redo for UPDATE_TEXT_BOX (content, position, formatting)', () => {
    const updatedBox: TextBox = {
      ...mockTextBox1,
      x: 150,
      y: 200,
      content: 'Updated Text',
      bold: true,
      fontSize: 24,
    };

    const currentState = {
      strokes: [],
      textBoxes: [updatedBox],
    };

    manager.push({
      type: 'UPDATE_TEXT_BOX',
      prev: mockTextBox1,
      current: updatedBox,
    });

    // Undo -> reverts to previous box properties
    const undoRes = manager.undo(currentState);
    expect(undoRes.textBoxes[0].x).toBe(100);
    expect(undoRes.textBoxes[0].content).toBe('Hello World');
    expect(undoRes.textBoxes[0].bold).toBe(false);
    expect(undoRes.textBoxes[0].fontSize).toBe(16);

    // Redo -> applies updated properties
    const redoRes = manager.redo(undoRes);
    expect(redoRes.textBoxes[0].x).toBe(150);
    expect(redoRes.textBoxes[0].content).toBe('Updated Text');
    expect(redoRes.textBoxes[0].bold).toBe(true);
    expect(redoRes.textBoxes[0].fontSize).toBe(24);
  });

  it('handles undo and redo for DELETE_TEXT_BOX', () => {
    const stateAfterDelete = {
      strokes: [],
      textBoxes: [],
    };

    manager.push({ type: 'DELETE_TEXT_BOX', textBox: mockTextBox1 });

    // Undo -> restores deleted text box
    const undoRes = manager.undo(stateAfterDelete);
    expect(undoRes.textBoxes).toHaveLength(1);
    expect(undoRes.textBoxes[0].id).toBe('tb1');

    // Redo -> removes it again
    const redoRes = manager.redo(undoRes);
    expect(redoRes.textBoxes).toHaveLength(0);
  });

  it('clears redo stack when a new action is pushed', () => {
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });
    manager.undo([mockStroke1]);
    expect(manager.canRedo()).toBe(true);

    manager.push({ type: 'ADD_TEXT_BOX', textBox: mockTextBox1 });
    expect(manager.canRedo()).toBe(false);
  });

  it('caps history stack to maxHistory', () => {
    const limitedManager = new HistoryManager(3);

    for (let i = 0; i < 5; i++) {
      limitedManager.push({
        type: 'ADD_STROKE',
        stroke: { ...mockStroke1, id: `s-${i}` },
      });
    }

    let count = 0;
    let current: Stroke[] = [];
    while (limitedManager.canUndo()) {
      limitedManager.undo(current);
      count++;
    }
    expect(count).toBe(3);
  });
});
