import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import * as db from "../db";
import { NOTEIN_FOLDER_COLORS } from "../components/library/CreateFolderModal";

describe("NoteIn APK Folder System", () => {
  beforeEach(async () => {
    await db.db.folders.clear();
    await db.db.notebooks.clear();
  });

  it("has authentic NoteIn Android folder color palette", () => {
    expect(NOTEIN_FOLDER_COLORS.length).toBeGreaterThanOrEqual(20);
    const names = NOTEIN_FOLDER_COLORS.map((c) => c.name);
    expect(names).toContain("Default");
    expect(names).toContain("Clay");
    expect(names).toContain("Dusty Blue");
    expect(names).toContain("Mint");
    expect(names).toContain("Rose");
    expect(names).toContain("Lilac");
    expect(names).toContain("Slate");
  });

  it("creates a folder with authentic color and attributes", async () => {
    const folder = await db.createFolder("Quantum Mechanics", "#007AFF", "Blue");
    expect(folder.id).toBeDefined();
    expect(folder.name).toBe("Quantum Mechanics");
    expect(folder.color).toBe("#007AFF");
    expect(folder.colorName).toBe("Blue");
    expect(folder.parentId).toBeNull();
    expect(folder.createdAt).toBeGreaterThan(0);

    const all = await db.getFolders();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe("Quantum Mechanics");
  });

  it("creates a nested subfolder within a parent folder", async () => {
    const parent = await db.createFolder("Physics", "#4E5262", "Default");
    const subfolder = await db.createFolder("Relativity", "#7892B5", "Dusty Blue", parent.id);

    expect(subfolder.parentId).toBe(parent.id);
    const retrieved = await db.getFolder(subfolder.id);
    expect(retrieved?.parentId).toBe(parent.id);
  });

  it("renames and updates folder color", async () => {
    const folder = await db.createFolder("Drafts", "#4E5262", "Default");
    const updated = await db.updateFolder(folder.id, {
      name: "Published Papers",
      color: "#34C759",
      colorName: "Green",
    });

    expect(updated?.name).toBe("Published Papers");
    expect(updated?.color).toBe("#34C759");
    expect(updated?.colorName).toBe("Green");
  });

  it("moves a notebook into a folder and back to root desktop", async () => {
    const folder = await db.createFolder("Neutrino Oscillations", "#8CB9C0", "Slate");
    const { notebook } = await db.createNotebook("Paper 2026", "#1e3a8a", "solid", db.DEFAULT_TEMPLATE, "portrait");

    expect(notebook.folderId).toBeUndefined();

    // Move to folder
    await db.moveNotebookToFolder(notebook.id, folder.id);
    const inFolder = await db.getNotebook(notebook.id);
    expect(inFolder?.folderId).toBe(folder.id);

    // Move back to desktop root
    await db.moveNotebookToFolder(notebook.id, null);
    const atRoot = await db.getNotebook(notebook.id);
    expect(atRoot?.folderId).toBeNull();
  });

  it("deleting a folder safely moves contained notebooks to root without losing data", async () => {
    const folder = await db.createFolder("Old Research", "#D98481", "Rose");
    const { notebook } = await db.createNotebook("Important Data", "#1e3a8a", "solid", db.DEFAULT_TEMPLATE, "portrait");
    await db.moveNotebookToFolder(notebook.id, folder.id);

    // Delete folder
    await db.deleteFolder(folder.id);

    const checkFolder = await db.getFolder(folder.id);
    expect(checkFolder).toBeUndefined();

    // Notebook should still exist with folderId set to null (root desktop)
    const checkNotebook = await db.getNotebook(notebook.id);
    expect(checkNotebook).toBeDefined();
    expect(checkNotebook?.folderId).toBeNull();
    expect(checkNotebook?.title).toBe("Important Data");
  });
});
