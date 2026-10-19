import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

export interface FolderColorOption {
  id: string;
  name: string;
  hex: string;
}

/**
 * Authentic NoteIn folder color palette decompiled from
 * com.orion.notein.domain.models.folder.FolderCoverColors and strings.xml
 */
export const NOTEIN_FOLDER_COLORS: FolderColorOption[] = [
  { id: "default", name: "Default", hex: "#4E5262" },
  { id: "clay", name: "Clay", hex: "#6B7280" },
  { id: "cream", name: "Cream", hex: "#E8B9A9" },
  { id: "dusty_blue", name: "Dusty Blue", hex: "#7892B5" },
  { id: "blue", name: "Blue", hex: "#007AFF" },
  { id: "brown", name: "Brown", hex: "#A2845E" },
  { id: "cyan", name: "Cyan", hex: "#32ADE6" },
  { id: "green", name: "Green", hex: "#34C759" },
  { id: "indigo", name: "Indigo", hex: "#5856D6" },
  { id: "mint", name: "Mint", hex: "#00C7BE" },
  { id: "orange", name: "Orange", hex: "#FF9500" },
  { id: "pink", name: "Pink", hex: "#FF2D55" },
  { id: "purple", name: "Purple", hex: "#AF52DE" },
  { id: "red", name: "Red", hex: "#FF3B30" },
  { id: "yellow", name: "Yellow", hex: "#FFCC00" },
  { id: "lilac", name: "Lilac", hex: "#A49EC2" },
  { id: "rose", name: "Rose", hex: "#D98481" },
  { id: "sage", name: "Sage", hex: "#92B5AA" },
  { id: "sand", name: "Sand", hex: "#EDCA7E" },
  { id: "slate", name: "Slate", hex: "#8CB9C0" },
  { id: "teal", name: "Teal", hex: "#008080" },
];

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, color: string, colorName: string) => void;
  initialName?: string;
  initialColor?: string;
  isEditMode?: boolean;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialName = "",
  initialColor = "#4E5262",
  isEditMode = false,
}) => {
  const [folderName, setFolderName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState<FolderColorOption>(() => {
    return (
      NOTEIN_FOLDER_COLORS.find((c) => c.hex.toLowerCase() === initialColor.toLowerCase()) ||
      NOTEIN_FOLDER_COLORS[0]
    );
  });

  useEffect(() => {
    if (isOpen) {
      setFolderName(initialName);
      const match = NOTEIN_FOLDER_COLORS.find(
        (c) => c.hex.toLowerCase() === initialColor.toLowerCase()
      );
      setSelectedColor(match || NOTEIN_FOLDER_COLORS[0]);
    }
  }, [isOpen, initialName, initialColor]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) return;
    onConfirm(trimmed, selectedColor.hex, selectedColor.name);
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
      {/* NoteIn 320dp Dialog layout (fragment_folder_creation_dialog.xml) */}
      <div
        className="animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "330px",
          maxWidth: "92vw",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "18px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--border-subtle)",
          padding: "24px 20px 16px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        {/* Authentic Folder Cover Preview (FolderCoverStackView + Cover Card + Strap) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "18px",
            position: "relative",
          }}
        >
          {/* Stacked Paper Sheets peeking out top (FolderCoverStackView) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "118px",
              height: "10px",
              position: "relative",
            }}
          >
            {/* Top Sheet Tab */}
            <div
              style={{
                width: "100px",
                height: "7px",
                borderRadius: "5px 5px 0 0",
                backgroundColor: selectedColor.hex,
                opacity: 0.35,
                marginBottom: "-3px",
              }}
            />
            {/* Middle Sheet Tab */}
            <div
              style={{
                width: "110px",
                height: "7px",
                borderRadius: "6px 6px 0 0",
                backgroundColor: selectedColor.hex,
                opacity: 0.65,
              }}
            />
          </div>

          {/* Folder Main Card Wrapper */}
          <div
            style={{
              width: "126px",
              height: "92px",
              borderRadius: "9px",
              backgroundColor: selectedColor.hex,
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.25)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transition: "background-color 0.22s ease",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            {/* Subtle Folder Crease / Flap highlight */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "40%",
                background: "linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Authentic NoteIn Folder Strap / Clasp (ic_note_list_folder_strap) */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "88px",
                height: "24px",
                backgroundColor: "rgba(255, 255, 255, 0.88)",
                borderRadius: "6px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "0 10px",
              }}
            >
              {/* Strap Tab Stitch Lines */}
              <div
                style={{
                  width: "3px",
                  height: "14px",
                  borderRadius: "1px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#1e293b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "56px",
                }}
              >
                {folderName.trim() || "Folder"}
              </span>
              <div
                style={{
                  width: "3px",
                  height: "14px",
                  borderRadius: "1px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                }}
              />
            </div>

            {/* Folder bottom shadow */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "6px",
                background: "linear-gradient(0deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%)",
              }}
            />
          </div>
        </div>

        {/* Dialog Title (New Folder / Edit Folder) */}
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "10px",
          }}
        >
          {isEditMode ? "Edit Folder" : "New Folder"}
        </div>

        {/* Folder Name Input with clear button (input_name & btn_clear) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            marginBottom: "14px",
          }}
        >
          <input
            id="notein-folder-name-input"
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            maxLength={100}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            style={{
              width: "100%",
              height: "38px",
              padding: "0 34px 0 12px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#007AFF";
              e.target.style.boxShadow = "0 0 0 3px rgba(0, 122, 255, 0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-subtle)";
              e.target.style.boxShadow = "none";
            }}
          />

          {/* Clear Button (btn_clear - ni_symbol_xmark_circle_fill) */}
          {folderName && (
            <button
              onClick={() => setFolderName("")}
              type="button"
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "rgba(100, 116, 139, 0.25)",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Selected Color Name Label */}
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "6px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Color:</span>
          <span style={{ color: selectedColor.hex, fontWeight: 700 }}>{selectedColor.name}</span>
        </div>

        {/* Color Palette List (rv_folder_color_list) */}
        <div
          style={{
            width: "100%",
            height: "48px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflowX: "auto",
            padding: "4px 2px 8px 2px",
            marginBottom: "16px",
            scrollbarWidth: "thin",
          }}
        >
          {NOTEIN_FOLDER_COLORS.map((col) => {
            const isSelected = selectedColor.id === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedColor(col)}
                title={col.name}
                style={{
                  width: "26px",
                  minWidth: "26px",
                  height: "26px",
                  borderRadius: "5px",
                  backgroundColor: col.hex,
                  border: isSelected ? "2px solid #007AFF" : "1px solid rgba(0, 0, 0, 0.15)",
                  boxShadow: isSelected
                    ? "0 0 0 2px var(--bg-secondary), 0 2px 6px rgba(0, 0, 0, 0.25)"
                    : "0 1px 3px rgba(0, 0, 0, 0.1)",
                  cursor: "pointer",
                  transform: isSelected ? "scale(1.15)" : "scale(1)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {isSelected && (
                  <Check
                    size={13}
                    color="#ffffff"
                    style={{
                      filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider (0.5dp line matching divider) */}
        <div
          style={{
            width: "100%",
            height: "1px",
            backgroundColor: "var(--border-subtle)",
            marginBottom: "12px",
          }}
        />

        {/* Action Buttons: Cancel and Confirm (btn_cancel & btn_confirm) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            Cancel
          </button>

          <button
            id="notein-folder-confirm-btn"
            type="button"
            onClick={() => handleSubmit()}
            disabled={!folderName.trim()}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: folderName.trim() ? "#007AFF" : "rgba(0, 122, 255, 0.4)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: folderName.trim() ? "pointer" : "not-allowed",
              boxShadow: folderName.trim() ? "0 3px 10px rgba(0, 122, 255, 0.35)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
