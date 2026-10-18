import type { HistoryAction, Stroke } from '../types';

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  public push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(currentStrokes: Stroke[]): { strokes: Stroke[]; action?: HistoryAction } {
    if (!this.canUndo()) {
      return { strokes: currentStrokes };
    }

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);

    switch (action.type) {
      case 'ADD_STROKE': {
        // Undo adding stroke = remove it
        const newStrokes = currentStrokes.filter((s) => s.id !== action.stroke.id);
        return { strokes: newStrokes, action };
      }
      case 'DELETE_STROKE': {
        // Undo deleting stroke = restore it
        const newStrokes = [...currentStrokes, action.stroke];
        return { strokes: newStrokes, action };
      }
      case 'DELETE_STROKES': {
        // Undo deleting multiple strokes = restore them
        const newStrokes = [...currentStrokes, ...action.strokes];
        return { strokes: newStrokes, action };
      }
      default:
        return { strokes: currentStrokes, action };
    }
  }

  public redo(currentStrokes: Stroke[]): { strokes: Stroke[]; action?: HistoryAction } {
    if (!this.canRedo()) {
      return { strokes: currentStrokes };
    }

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);

    switch (action.type) {
      case 'ADD_STROKE': {
        // Redo adding stroke = re-add it
        const newStrokes = [...currentStrokes, action.stroke];
        return { strokes: newStrokes, action };
      }
      case 'DELETE_STROKE': {
        // Redo deleting stroke = remove it
        const newStrokes = currentStrokes.filter((s) => s.id !== action.stroke.id);
        return { strokes: newStrokes, action };
      }
      case 'DELETE_STROKES': {
        // Redo deleting multiple strokes = remove them
        const deletedIds = new Set(action.strokes.map((s) => s.id));
        const newStrokes = currentStrokes.filter((s) => !deletedIds.has(s.id));
        return { strokes: newStrokes, action };
      }
      default:
        return { strokes: currentStrokes, action };
    }
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
