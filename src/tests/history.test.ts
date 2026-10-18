import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../engine/history';
import type { Stroke } from '../types';

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

  beforeEach(() => {
    manager = new HistoryManager(10);
  });

  it('starts with empty undo and redo stacks', () => {
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
  });

  it('handles undo and redo for ADD_STROKE', () => {
    let strokes: Stroke[] = [];

    // Add stroke 1
    strokes.push(mockStroke1);
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });

    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    // Undo ADD_STROKE
    const undoRes = manager.undo(strokes);
    expect(undoRes.strokes).toHaveLength(0);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    // Redo ADD_STROKE
    const redoRes = manager.redo(undoRes.strokes);
    expect(redoRes.strokes).toHaveLength(1);
    expect(redoRes.strokes[0].id).toBe('s1');
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
  });

  it('handles undo and redo for DELETE_STROKE', () => {
    let strokes: Stroke[] = [mockStroke1, mockStroke2];

    // Delete stroke 1
    strokes = strokes.filter((s) => s.id !== 's1');
    manager.push({ type: 'DELETE_STROKE', stroke: mockStroke1 });

    expect(strokes).toHaveLength(1);

    // Undo delete -> restores mockStroke1
    const undoRes = manager.undo(strokes);
    expect(undoRes.strokes).toHaveLength(2);
    expect(undoRes.strokes.some((s) => s.id === 's1')).toBe(true);

    // Redo delete -> removes mockStroke1 again
    const redoRes = manager.redo(undoRes.strokes);
    expect(redoRes.strokes).toHaveLength(1);
    expect(redoRes.strokes[0].id).toBe('s2');
  });

  it('handles undo and redo for DELETE_STROKES (batch eraser swipe)', () => {
    let strokes: Stroke[] = [mockStroke1, mockStroke2];

    // Erase both strokes in one sweep
    strokes = [];
    manager.push({ type: 'DELETE_STROKES', strokes: [mockStroke1, mockStroke2] });

    // Undo batch delete -> restores both
    const undoRes = manager.undo(strokes);
    expect(undoRes.strokes).toHaveLength(2);

    // Redo batch delete -> removes both
    const redoRes = manager.redo(undoRes.strokes);
    expect(redoRes.strokes).toHaveLength(0);
  });

  it('clears redo stack when a new action is pushed', () => {
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });
    manager.undo([mockStroke1]);
    expect(manager.canRedo()).toBe(true);

    // Push new action
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke2 });
    expect(manager.canRedo()).toBe(false);
  });

  it('caps history stack to maxHistory', () => {
    const limitedManager = new HistoryManager(3);

    for (let i = 0; i < 5; i++) {
      const stroke: Stroke = {
        ...mockStroke1,
        id: `s-${i}`,
      };
      limitedManager.push({ type: 'ADD_STROKE', stroke });
    }

    // Should only be able to undo 3 times
    let count = 0;
    let current: Stroke[] = [];
    while (limitedManager.canUndo()) {
      limitedManager.undo(current);
      count++;
    }
    expect(count).toBe(3);
  });

  it('clears history completely with clear()', () => {
    manager.push({ type: 'ADD_STROKE', stroke: mockStroke1 });
    manager.clear();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
  });
});
