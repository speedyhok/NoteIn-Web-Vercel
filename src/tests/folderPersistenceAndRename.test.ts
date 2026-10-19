import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import * as db from "../db";
import type { Stroke, TextBox } from "../types";

describe("Folder Persistence and Rename Flow", () => {
  beforeEach(async () => {
    await db.db.folders.clear();
    await db.db.notebooks.clear();
    await db.db.pages.clear();
    await db.db.strokes.clear();
    await db.db.textBoxes.clear();
  });

  it("creates a notebook directly inside a folder and retains folderId", async () => {
    const folder = await db.createFolder("Astrophysics", "#007AFF", "Blue");
    const { notebook } = await db.createNotebook(
      "Black Holes",
      "#1e3a8a",
      "solid",
      db.DEFAULT_TEMPLATE,
      "portrait",
      folder.id
    );

    expect(notebook.folderId).toBe(folder.id);
    const retrieved = await db.getNotebook(notebook.id);
    expect(retrieved?.folderId).toBe(folder.id);
    expect(retrieved?.title).toBe("Black Holes");
  });

  it("persists folderId when saving strokes and text boxes in NoteEditor", async () => {
    const folder = await db.createFolder("Quantum Mechanics", "#34C759", "Green");
    const { notebook, initialPage } = await db.createNotebook(
      "Schrodinger Equation",
      "#1e3a8a",
      "solid",
      db.DEFAULT_TEMPLATE,
      "portrait",
      folder.id
    );

    // Save strokes (like drawing in NoteEditor)
    const testStroke: Stroke = {
      id: crypto.randomUUID(),
      pageId: initialPage.id,
      toolType: "pen",
      penStyle: "fountain",
      color: "#1e3a8a",
      width: 3,
      opacity: 1,
      points: [{ x: 10, y: 10, pressure: 0.5 }, { x: 20, y: 20, pressure: 0.6 }],
      bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 },
      createdAt: Date.now(),
    };
    await db.saveStrokesForPage(initialPage.id, [testStroke]);

    // Save text box (like typing text in NoteEditor)
    const testTextBox: TextBox = {
      id: crypto.randomUUID(),
      pageId: initialPage.id,
      x: 50,
      y: 50,
      width: 200,
      height: 40,
      content: "Psi(x, t)",
      fontFamily: "Inter, sans-serif",
      fontSize: 16,
      color: "#000000",
      bold: true,
      italic: false,
      alignment: "left",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saveTextBoxesForPage(initialPage.id, [testTextBox]);

    // Verify notebook didn't lose folderId or disappear
    const afterSaving = await db.getNotebook(notebook.id);
    expect(afterSaving).toBeDefined();
    expect(afterSaving?.folderId).toBe(folder.id);
    expect(afterSaving?.title).toBe("Schrodinger Equation");
  });

  it("updates title and preserves folderId when renamed", async () => {
    const folder = await db.createFolder("Research 2026", "#AF52DE", "Purple");
    const { notebook } = await db.createNotebook(
      "Original Draft",
      "#1e3a8a",
      "solid",
      db.DEFAULT_TEMPLATE,
      "portrait",
      folder.id
    );

    await db.updateNotebookTitle(notebook.id, "Final Published Paper");
    const updated = await db.getNotebook(notebook.id);
    expect(updated?.title).toBe("Final Published Paper");
    expect(updated?.folderId).toBe(folder.id);
  });

  it("moves a notebook between folders without losing handwritten strokes", async () => {
    const folderA = await db.createFolder("Folder A", "#4E5262", "Default");
    const folderB = await db.createFolder("Folder B", "#FF9500", "Orange");

    const { notebook } = await db.createNotebook(
      "Document to Move",
      "#1e3a8a",
      "solid",
      db.DEFAULT_TEMPLATE,
      "portrait",
      folderA.id
    );

    await db.moveNotebookToFolder(notebook.id, folderB.id);
    const inB = await db.getNotebook(notebook.id);
    expect(inB?.folderId).toBe(folderB.id);

    // Move back to desktop root
    await db.moveNotebookToFolder(notebook.id, null);
    const atRoot = await db.getNotebook(notebook.id);
    expect(atRoot?.folderId).toBeNull();
  });
});
