import React, { useState } from "react";
import type { Folder, Notebook } from "../../types";
import { NoteinFolderFill } from "../icons/NoteinIcons";
import { Check, Plus, ArrowLeft, X } from "lucide-react";
import { NOTEIN_FOLDER_COLORS } from "./CreateFolderModal";

interface MoveToFolderModalProps {
  isOpen: boolean;
  notebook: Notebook | null;
  folders: Folder[];
  onClose: () => void;
  onMove: (notebookId: string, targetFolderId: string | null) => void;
  onCreateFolder: (name: string, color: string, colorName: string) => Promise<Folder>;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  notebook,
  folders,
  onClose,
  onMove,
  onCreateFolder,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(notebook?.folderId || null);
  const [isCreatorExpanded, setIsCreatorExpanded] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(NOTEIN_FOLDER_COLORS[0]);

  if (!isOpen || !notebook) return null;

  const handleCreateNewFolderInline = async () => {
    if (!newFolderName.trim()) return;
    const created = await onCreateFolder(newFolderName.trim(), newFolderColor.hex, newFolderColor.name);
    setSelectedFolderId(created.id);
    setNewFolderName("");
    setIsCreatorExpanded(false);
  };

  const handleConfirmMove = () => {
    onMove(notebook.id, selectedFolderId);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(3px)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "360px",
          maxWidth: "92vw",
          maxHeight: "85vh",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "18px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Move to Folder
            </h3>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Select destination for <strong style={{ color: "var(--text-primary)" }}>{notebook.title}</strong>
          </div>
        </div>

        {/* Inline Create Folder Section (fragment_move_to_folder_creator) */}
        <div style={{ padding: "12px 16px 6px 16px" }}>
          {!isCreatorExpanded ? (
            <button
              onClick={() => setIsCreatorExpanded(true)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px dashed var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "#007AFF",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={16} color="#007AFF" />
              <span>Create New Folder</span>
            </button>
          ) : (
            <div
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setIsCreatorExpanded(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ArrowLeft size={16} />
                </button>
                <input
                  type="text"
                  placeholder="New folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateNewFolderInline();
                  }}
                  style={{
                    flex: 1,
                    height: "32px",
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleCreateNewFolderInline}
                  disabled={!newFolderName.trim()}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: newFolderName.trim() ? "#007AFF" : "var(--border-subtle)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: newFolderName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Create
                </button>
              </div>

              {/* Color swatches */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  overflowX: "auto",
                  paddingBottom: "4px",
                }}
              >
                {NOTEIN_FOLDER_COLORS.slice(0, 10).map((col) => {
                  const isSel = newFolderColor.id === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setNewFolderColor(col)}
                      style={{
                        width: "20px",
                        minWidth: "20px",
                        height: "20px",
                        borderRadius: "4px",
                        backgroundColor: col.hex,
                        border: isSel ? "2px solid #007AFF" : "1px solid rgba(0,0,0,0.1)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Destination List (item_folder_dialog_folder.xml) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {/* Desktop / Root Destination */}
          <div
            onClick={() => setSelectedFolderId(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: "10px",
              backgroundColor: selectedFolderId === null ? "rgba(0, 122, 255, 0.08)" : "transparent",
              border: selectedFolderId === null ? "1px solid rgba(0, 122, 255, 0.3)" : "1px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(0, 122, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NoteinFolderFill size={18} color="#007AFF" />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Desktop (All Notes)
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Root Library</span>
              </div>
            </div>
            {selectedFolderId === null && <Check size={18} color="#007AFF" />}
          </div>

          {/* User Folders */}
          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                className="move-dest-folder-row"
                data-folder-id={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  backgroundColor: isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent",
                  border: isSelected ? "1px solid rgba(0, 122, 255, 0.3)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      backgroundColor: `${folder.color}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <NoteinFolderFill size={18} color={folder.color} />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {folder.name}
                  </span>
                </div>
                {isSelected && <Check size={18} color="#007AFF" />}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            id="move-folder-confirm-btn"
            onClick={handleConfirmMove}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#007AFF",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 3px 10px rgba(0, 122, 255, 0.35)",
            }}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
};
