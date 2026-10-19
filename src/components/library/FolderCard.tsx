import React, { useState } from "react";
import type { Folder, Notebook } from "../../types";
import { NotebookPagePreview } from "./NotebookPagePreview";
import { NoteinFolderFill, NoteinMore } from "../icons/NoteinIcons";
import { Edit2, Palette, Trash2 } from "lucide-react";

interface FolderCardProps {
  folder: Folder;
  itemCount: number;
  insideNotebooks?: Notebook[];
  viewMode?: "grid" | "list";
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onChangeColor: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onDropNotebook?: (notebookId: string, folderId: string) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  itemCount,
  insideNotebooks = [],
  viewMode = "grid",
  onOpen,
  onRename,
  onChangeColor,
  onDelete,
  onDropNotebook,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragTarget, setIsDragTarget] = useState(false);

  const folderColor = folder.color || "#4E5262";

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onOpen(folder)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!isDragTarget) setIsDragTarget(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragTarget(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragTarget(false);
          const nbId = e.dataTransfer.getData('text/plain');
          if (nbId && onDropNotebook) {
            onDropNotebook(nbId, folder.id);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: "8px",
          backgroundColor: isDragTarget ? "rgba(0, 122, 255, 0.12)" : isHovered ? "var(--bg-tertiary)" : "transparent",
          outline: isDragTarget ? "2px solid #007AFF" : "none",
          cursor: "pointer",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", overflow: "hidden" }}>
          {/* List Mode Folder Icon */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: `${folderColor}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <NoteinFolderFill size={22} color={folderColor} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
              title="Click to rename folder"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {folder.name}
              </span>
              <Edit2 size={12} color="var(--text-muted)" style={{ opacity: 0.65 }} />
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {itemCount === 0 ? "Empty folder" : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </div>
          </div>
        </div>

        {/* List Menu Action */}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: "6px",
              borderRadius: "6px",
              color: "var(--text-muted)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Folder options"
          >
            <NoteinMore size={18} />
          </button>

          {menuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 50 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="animate-scale-up"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "6px",
                  width: "150px",
                  borderRadius: "10px",
                  padding: "5px",
                  zIndex: 60,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    textAlign: "left",
                  }}
                >
                  <Edit2 size={13} />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onChangeColor(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    textAlign: "left",
                  }}
                >
                  <Palette size={13} />
                  Change Color
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--danger, #ef4444)",
                    textAlign: "left",
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Grid View Mode (Authentic NoteIn Folder Card)
  return (
    <div
      className="folder-card"
      onClick={() => onOpen(folder)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragTarget) setIsDragTarget(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragTarget(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragTarget(false);
        const nbId = e.dataTransfer.getData('text/plain');
        if (nbId && onDropNotebook) {
          onDropNotebook(nbId, folder.id);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "14px",
        overflow: "hidden",
        backgroundColor: isDragTarget ? "rgba(0, 122, 255, 0.08)" : "var(--bg-secondary)",
        border: isDragTarget ? "2px solid #007AFF" : "1px solid var(--border-subtle)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: isDragTarget ? "scale(1.03)" : isHovered ? "translateY(-4px)" : "none",
        boxShadow: isDragTarget
          ? "0 0 16px rgba(0, 122, 255, 0.45)"
          : isHovered
          ? "0 12px 28px rgba(0, 0, 0, 0.14)"
          : "0 2px 8px rgba(0, 0, 0, 0.04)",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Folder Visual Card Wrapper */}
      <div
        className="folder-card-visual"
        style={{
          height: "176px",
          width: "100%",
          backgroundColor: "var(--bg-tertiary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 16px 8px 16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {insideNotebooks && insideNotebooks.length > 0 ? (
          /* Folder keeping its color, showing inside file in library card format with authentic preview */
          <div
            style={{
              width: "138px",
              height: "148px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            {/* Top Folder Tab in Folder Color */}
            <div
              style={{
                position: "absolute",
                top: "4px",
                left: "4px",
                width: "52px",
                height: "14px",
                borderRadius: "6px 6px 0 0",
                backgroundColor: folderColor,
                filter: "brightness(0.92)",
                zIndex: 1,
              }}
            />

            {/* Folder Back Plate in Folder Color */}
            <div
              style={{
                position: "absolute",
                top: "14px",
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: "9px",
                backgroundColor: folderColor,
                boxShadow: "0 6px 18px rgba(0, 0, 0, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                zIndex: 1,
              }}
            />

            {/* Secondary stacked paper sheet behind if multiple notebooks inside */}
            {insideNotebooks.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  width: "94px",
                  height: "128px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "5px",
                  transform: "rotate(3.5deg) translate(6px, -2px)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  zIndex: 2,
                }}
              />
            )}

            {/* Inside File in Library Card Format (authentic page preview) */}
            <div
              style={{
                position: "absolute",
                top: "8px",
                zIndex: 3,
                transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: isHovered ? "translateY(-6px)" : "translateY(0)",
                filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.16))",
              }}
            >
              <NotebookPagePreview notebook={insideNotebooks[0]} scale={0.76} hideBadge={true} />
            </div>

            {/* Folder Front Pocket in Folder Color (cradling the document preview) */}
            <div
              style={{
                width: "100%",
                height: "54px",
                borderRadius: "0 0 9px 9px",
                background: `linear-gradient(180deg, ${folderColor}f2 0%, ${folderColor} 100%)`,
                borderTop: "2px solid rgba(255, 255, 255, 0.4)",
                boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                position: "relative",
                zIndex: 4,
              }}
            >
              {/* Solid NoteIn Folder Icon */}
              <div style={{ opacity: 0.95, display: "flex", alignItems: "center" }}>
                <NoteinFolderFill size={15} color="#ffffff" />
              </div>

              {/* Physical clasp detail */}
              <div
                style={{
                  width: "28px",
                  height: "14px",
                  backgroundColor: "rgba(255, 255, 255, 0.88)",
                  borderRadius: "4px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "3px",
                }}
              >
                <div style={{ width: "2px", height: "8px", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: "1px" }} />
                <div style={{ width: "4px", height: "4px", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: "50%" }} />
                <div style={{ width: "2px", height: "8px", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: "1px" }} />
              </div>

              {/* Item count badge pill */}
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#ffffff",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  padding: "2px 7px",
                  borderRadius: "9999px",
                  letterSpacing: "0.2px",
                  backdropFilter: "blur(4px)",
                }}
              >
                {itemCount} {itemCount === 1 ? "file" : "files"}
              </div>
            </div>
          </div>
        ) : (
          /* Empty Folder keeping Folder Color */
          <>
            {/* Layered Paper Sheets Tabs (FolderCoverStackView) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "120px",
                height: "10px",
                position: "relative",
              }}
            >
              {/* Top Paper Tab */}
              <div
                style={{
                  width: "104px",
                  height: "7px",
                  borderRadius: "5px 5px 0 0",
                  backgroundColor: folderColor,
                  opacity: 0.35,
                  marginBottom: "-3px",
                }}
              />
              {/* Middle Paper Tab */}
              <div
                style={{
                  width: "114px",
                  height: "7px",
                  borderRadius: "6px 6px 0 0",
                  backgroundColor: folderColor,
                  opacity: 0.65,
                }}
              />
            </div>

            {/* Realistic Folder Flap Body */}
            <div
              style={{
                width: "130px",
                height: "96px",
                borderRadius: "9px",
                backgroundColor: folderColor,
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                transition: "transform 0.18s ease",
                transform: isHovered ? "scale(1.02)" : "scale(1)",
              }}
            >
              {/* Top Highlight Crease */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "38%",
                  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255) 100%)",
                  pointerEvents: "none",
                  borderRadius: "8px 8px 0 0",
                }}
              />

              {/* Solid NoteIn Folder Icon in top left */}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "10px",
                  opacity: 0.85,
                }}
              >
                <NoteinFolderFill size={16} color="#ffffff" />
              </div>

              {/* Authentic NoteIn Folder Strap Clasp (Clean physical clasp without text) */}
              <div
                style={{
                  width: "48px",
                  height: "22px",
                  backgroundColor: "rgba(255, 255, 255, 0.92)",
                  borderRadius: "5px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: "3px",
                    height: "12px",
                    borderRadius: "1px",
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                  }}
                />
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    boxShadow: "inset 0 1px 1px rgba(0,0,0,0.3)",
                  }}
                />
                <div
                  style={{
                    width: "3px",
                    height: "12px",
                    borderRadius: "1px",
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                  }}
                />
              </div>

              {/* Item count badge pill inside folder */}
              <div
                style={{
                  position: "absolute",
                  bottom: "7px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.92)",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  padding: "1px 8px",
                  borderRadius: "9999px",
                }}
              >
                Empty
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info Footer & 3-Dot Options */}
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRename(folder);
            }}
            title="Click to rename folder"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
                transition: "color 0.15s ease",
              }}
            >
              {folder.name}
            </h3>
            <Edit2 size={12} color="var(--text-muted)" style={{ flexShrink: 0, opacity: 0.65 }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{itemCount === 0 ? "Folder • 0 items" : `Folder • ${itemCount} ${itemCount === 1 ? "item" : "items"}`}</span>
          </div>
        </div>

        {/* 3-Dot Context Menu */}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: "6px",
              borderRadius: "6px",
              color: "var(--text-muted)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Folder options"
          >
            <NoteinMore size={18} />
          </button>

          {menuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 50 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="animate-scale-up"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "100%",
                  marginBottom: "6px",
                  width: "150px",
                  borderRadius: "10px",
                  padding: "5px",
                  zIndex: 60,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    textAlign: "left",
                  }}
                >
                  <Edit2 size={13} />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onChangeColor(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    textAlign: "left",
                  }}
                >
                  <Palette size={13} />
                  Change Color
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(folder);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "var(--danger, #ef4444)",
                    textAlign: "left",
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
