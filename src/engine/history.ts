import type { HistoryAction, Stroke, TextBox } from '../types';

export interface EditorHistoryState {
  strokes: Stroke[];
  textBoxes: TextBox[];
}

export type HistoryListener = (canUndo: boolean, canRedo: boolean) => void;

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory: number;
  private listeners: Set<HistoryListener> = new Set();

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  public subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    this.listeners.forEach((listener) => {
      try {
        listener(canUndo, canRedo);
      } catch (err) {
        console.error('Error in history listener:', err);
      }
    });
  }

  public push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];
    this.notify();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(
    target: EditorHistoryState | Stroke[]
  ): { strokes: Stroke[]; textBoxes: TextBox[]; action?: HistoryAction } {
    const isArray = Array.isArray(target);
    const currentState: EditorHistoryState = isArray
      ? { strokes: target, textBoxes: [] }
      : target;

    if (!this.canUndo()) {
      return { strokes: currentState.strokes, textBoxes: currentState.textBoxes };
    }

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);
    this.notify();

    let newStrokes = currentState.strokes;
    let newTextBoxes = currentState.textBoxes;

    switch (action.type) {
      case 'ADD_STROKE': {
        newStrokes = newStrokes.filter((s) => s.id !== action.stroke.id);
        break;
      }
      case 'DELETE_STROKE': {
        newStrokes = [...newStrokes, action.stroke];
        break;
      }
      case 'DELETE_STROKES': {
        newStrokes = [...newStrokes, ...action.strokes];
        break;
      }
      case 'ADD_TEXT_BOX': {
        newTextBoxes = newTextBoxes.filter((t) => t.id !== action.textBox.id);
        break;
      }
      case 'DELETE_TEXT_BOX': {
        newTextBoxes = [...newTextBoxes, action.textBox];
        break;
      }
      case 'UPDATE_TEXT_BOX': {
        newTextBoxes = newTextBoxes.map((t) => (t.id === action.current.id ? action.prev : t));
        break;
      }
      default:
        break;
    }

    return { strokes: newStrokes, textBoxes: newTextBoxes, action };
  }

  public redo(
    target: EditorHistoryState | Stroke[]
  ): { strokes: Stroke[]; textBoxes: TextBox[]; action?: HistoryAction } {
    const isArray = Array.isArray(target);
    const currentState: EditorHistoryState = isArray
      ? { strokes: target, textBoxes: [] }
      : target;

    if (!this.canRedo()) {
      return { strokes: currentState.strokes, textBoxes: currentState.textBoxes };
    }

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);
    this.notify();

    let newStrokes = currentState.strokes;
    let newTextBoxes = currentState.textBoxes;

    switch (action.type) {
      case 'ADD_STROKE': {
        newStrokes = [...newStrokes, action.stroke];
        break;
      }
      case 'DELETE_STROKE': {
        newStrokes = newStrokes.filter((s) => s.id !== action.stroke.id);
        break;
      }
      case 'DELETE_STROKES': {
        const deletedIds = new Set(action.strokes.map((s) => s.id));
        newStrokes = newStrokes.filter((s) => !deletedIds.has(s.id));
        break;
      }
      case 'ADD_TEXT_BOX': {
        newTextBoxes = [...newTextBoxes, action.textBox];
        break;
      }
      case 'DELETE_TEXT_BOX': {
        newTextBoxes = newTextBoxes.filter((t) => t.id !== action.textBox.id);
        break;
      }
      case 'UPDATE_TEXT_BOX': {
        newTextBoxes = newTextBoxes.map((t) => (t.id === action.prev.id ? action.current : t));
        break;
      }
      default:
        break;
    }

    return { strokes: newStrokes, textBoxes: newTextBoxes, action };
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
