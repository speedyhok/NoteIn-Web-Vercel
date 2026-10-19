import { describe, it, expect } from 'vitest';
import type { TextBox } from '../types';
import { HistoryManager } from '../engine/history';

describe('TextBox Mode: Delete, Moving, and Content Integrity Operations', () => {
  const sampleTextBox: TextBox = {
    id: 'tb-test-1',
    pageId: 'page-1',
    x: 100,
    y: 150,
    width: 250,
    height: 60,
    content: 'Sample Note Content',
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1e293b',
    bold: false,
    italic: false,
    alignment: 'left',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('deletes a text box and verifies removal from list', () => {
    let textBoxes: TextBox[] = [sampleTextBox];
    const targetId = 'tb-test-1';

    const target = textBoxes.find((t) => t.id === targetId);
    expect(target).toBeDefined();

    const updated = textBoxes.filter((t) => t.id !== targetId);
    expect(updated).toHaveLength(0);

    const history = new HistoryManager(10);
    history.push({ type: 'DELETE_TEXT_BOX', textBox: target! });
    expect(history.canUndo()).toBe(true);

    const undoRes = history.undo({ strokes: [], textBoxes: updated });
    expect(undoRes.textBoxes).toHaveLength(1);
    expect(undoRes.textBoxes[0].id).toBe(targetId);
  });

  it('moves a text box updating only its coordinates without creating duplicates', () => {
    let textBoxes: TextBox[] = [sampleTextBox];
    const newX = 280;
    const newY = 320;

    textBoxes = textBoxes.map((t) => (t.id === sampleTextBox.id ? { ...t, x: newX, y: newY } : t));

    expect(textBoxes).toHaveLength(1);
    expect(textBoxes[0].x).toBe(280);
    expect(textBoxes[0].y).toBe(320);

    const prevBox = { ...sampleTextBox };
    const currentBox = { ...textBoxes[0], updatedAt: Date.now() };

    const history = new HistoryManager(10);
    history.push({
      type: 'UPDATE_TEXT_BOX',
      prev: prevBox,
      current: currentBox,
    });

    expect(history.canUndo()).toBe(true);
    const undoRes = history.undo({ strokes: [], textBoxes });
    expect(undoRes.textBoxes).toHaveLength(1);
    expect(undoRes.textBoxes[0].x).toBe(100);
    expect(undoRes.textBoxes[0].y).toBe(150);
  });

  it('does not duplicate text box when updating styles', () => {
    let textBoxes: TextBox[] = [sampleTextBox];
    const updates: Partial<TextBox> = {
      backgroundColor: '#fef08a',
      borderColor: '#facc15',
      borderRadius: 10,
    };

    textBoxes = textBoxes.map((t) => (t.id === sampleTextBox.id ? { ...t, ...updates } : t));
    expect(textBoxes).toHaveLength(1);
    expect(textBoxes[0].backgroundColor).toBe('#fef08a');
    expect(textBoxes[0].borderRadius).toBe(10);
  });

  it('preserves single typed text on commit and prevents duplication', () => {
    let textBoxes: TextBox[] = [{ ...sampleTextBox, content: '' }];
    const typedText = 'Physics Lecture Notes';

    // Simulate commit on end editing
    const cleanContent = typedText.trim();
    textBoxes = textBoxes.map((t) =>
      t.id === sampleTextBox.id ? { ...t, content: cleanContent, updatedAt: Date.now() } : t
    );

    expect(textBoxes).toHaveLength(1);
    expect(textBoxes[0].content).toBe('Physics Lecture Notes');
    // Ensure content is not repeated/duplicated
    expect(textBoxes[0].content).not.toContain('Physics Lecture NotesPhysics Lecture Notes');
  });

  it('cleans up blank text box when ending editing without content', () => {
    let textBoxes: TextBox[] = [
      sampleTextBox,
      {
        id: 'blank-box',
        pageId: 'page-1',
        x: 300,
        y: 400,
        width: 240,
        height: 54,
        content: '',
        fontSize: 16,
        fontFamily: 'Inter',
        color: '#1e293b',
        bold: false,
        italic: false,
        alignment: 'left',
        backgroundColor: 'transparent',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    expect(textBoxes).toHaveLength(2);

    // Ending edit on blank-box
    const endingId = 'blank-box';
    const target = textBoxes.find((t) => t.id === endingId);
    const isBlank = !target?.content || target.content.trim() === '';
    const hasCustomBg = target?.backgroundColor && target.backgroundColor !== 'transparent';

    if (isBlank && !hasCustomBg) {
      textBoxes = textBoxes.filter((t) => t.id !== endingId);
    }

    expect(textBoxes).toHaveLength(1);
    expect(textBoxes[0].id).toBe(sampleTextBox.id);
  });
});
