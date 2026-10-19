import React, { useState, useMemo, useEffect } from "react";
import type { Notebook, PaperTemplate, Folder, PageOrientation, GoogleUser } from "../../types";
import * as db from "../../db";
import { NotebookCard } from "./NotebookCard";
import { FolderCard } from "./FolderCard";
import { CreateFolderModal } from "./CreateFolderModal";
import { MoveToFolderModal } from "./MoveToFolderModal";
import { NoteinSidebar, type SidebarTab, type DrawerSection } from "./NoteinSidebar";
import { CreateNotebookModal } from "./CreateNotebookModal";
import { Modal } from "../common/Modal";
import { GoogleDriveModal } from "../cloud/GoogleDriveModal";
import { ImportDocumentModal } from "./ImportDocumentModal";
import { getGoogleUser } from "../../services/googleDriveService";
import {
  NoteinSearch,
  NoteinGridView,
  NoteinListView,
  NoteinFilter,
  NoteinAdd,
  NoteinEdit,
  NoteinFolderFill,
} from "../icons/NoteinIcons";
import {
  Sun,
  Moon,
  Sparkles,
  Upload,
  Menu,
  Check,
  X,
  Plus,
  ArrowLeft,
  Edit2,
  ChevronRight,
  FolderPlus,
  FileText,
} from "lucide-react";

interface NotebookLibraryProps {
  notebooks: Notebook[];
  currentFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
  onOpenNotebook: (notebook: Notebook) => void;
  onCreateNotebook: (
    title: string,
    coverColor: string,
    coverPattern: Notebook["coverPattern"],
    template: PaperTemplate,
    orientation: PageOrientation,
    folderId?: string | null
  ) => void;
  onRenameNotebook: (id: string, newTitle: string) => void;
  onDeleteNotebook: (id: string) => void;
  onMoveNotebookToFolder?: (notebookId: string, folderId: string | null) => void;
  onImportNotebook?: (notebook: Notebook) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

type SortBy = "updatedAt" | "title" | "pageCount";
type ViewMode = "grid" | "list";

const DEFAULT_CATEGORIES = ["All Notes", "Study & Research", "Physics", "Formulas", "Personal"];

export const NotebookLibrary: React.FC<NotebookLibraryProps> = ({
  notebooks,
  currentFolderId: propFolderId,
  onSelectFolder,
  onOpenNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onMoveNotebookToFolder,
  onImportNotebook,
  isDarkMode,
  onToggleTheme,
}) => {
  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState<SidebarTab>("categories");
  const [activeSection, setActiveSection] = useState<DrawerSection>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Notes");
  const [categoriesList, setCategoriesList] = useState<string[]>(DEFAULT_CATEGORIES);
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Folder system state (Authentic NoteIn hierarchy)
  const [folders, setFolders] = useState<Folder[]>([]);
  const [internalFolderId, setInternalFolderId] = useState<string | null>(null);

  const currentFolderId = propFolderId !== undefined ? propFolderId : internalFolderId;
  const setCurrentFolderId = (folderId: string | null) => {
    if (onSelectFolder) {
      onSelectFolder(folderId);
    }
    setInternalFolderId(folderId);
  };
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [movingNotebook, setMovingNotebook] = useState<Notebook | null>(null);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deletingNotebook, setDeletingNotebook] = useState<Notebook | null>(null);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Drag & drop file
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => getGoogleUser());

  // Load folders from IndexedDB
  const reloadFolders = async () => {
    try {
      const loaded = await db.getFolders();
      setFolders(loaded);
    } catch (e) {
      console.error("Failed to load folders:", e);
    }
  };

  useEffect(() => {
    reloadFolders();
  }, []);

  // Global Drag & Drop listener
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        setDroppedFile(e.dataTransfer.files[0]);
        setIsImportOpen(true);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // Filter & Section calculations
  const totalCount = notebooks.length;
  const recentCount = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 86400000;
    return notebooks.filter((n) => n.updatedAt >= oneWeekAgo).length;
  }, [notebooks]);
  const favoritesCount = useMemo(() => notebooks.filter((n) => n.isFavorite).length, [notebooks]);
  const trashCount = useMemo(() => notebooks.filter((n) => n.isTrash).length, [notebooks]);

  // Current folder object
  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === currentFolderId) || null;
  }, [folders, currentFolderId]);

  // Compute folder breadcrumb trail
  const breadcrumbTrail = useMemo(() => {
    const trail: Folder[] = [];
    let cur = currentFolder;
    while (cur) {
      trail.unshift(cur);
      if (!cur.parentId) break;
      cur = folders.find((f) => f.id === cur?.parentId) || null;
    }
    return trail;
  }, [folders, currentFolder]);

  // Main Filter Pipeline for Notebooks
  const filteredNotebooks = useMemo(() => {
    return notebooks
      .filter((nb) => {
        // Section Filter
        if (activeSection === "trash") {
          if (!nb.isTrash) return false;
        } else {
          if (nb.isTrash) return false;
          if (activeSection === "recent") {
            const oneWeekAgo = Date.now() - 7 * 86400000;
            if (nb.updatedAt < oneWeekAgo) return false;
          } else if (activeSection === "favorites") {
            if (!nb.isFavorite) return false;
          }
        }

        // Search Query (Searches globally across all folders)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = nb.title.toLowerCase().includes(q);
          const matchCategory = nb.category?.toLowerCase().includes(q);
          if (!matchTitle && !matchCategory) return false;
          return true;
        }

        // Folder Filtering (When in standard "all" documents view)
        if (activeSection === "all") {
          if (currentFolderId) {
            if (nb.folderId !== currentFolderId) return false;
          } else {
            // Root shelf: show only notebooks that are NOT inside a folder
            if (nb.folderId) return false;
          }
        }

        // Category Tag Chip
        if (selectedCategory !== "All Notes") {
          const matchesCat =
            nb.category === selectedCategory ||
            nb.title.toLowerCase().includes(selectedCategory.toLowerCase()) ||
            nb.tags?.includes(selectedCategory);
          if (!matchesCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "pageCount") {
          return (b.pageCount || 1) - (a.pageCount || 1);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [notebooks, activeSection, searchQuery, selectedCategory, sortBy, currentFolderId]);

  // Folders to display in current shelf view
  const displayedFolders = useMemo(() => {
    // If searching or in special section (recent/favs/trash), don't show folder cards
    if (searchQuery.trim() || activeSection !== "all") {
      return [];
    }
    if (currentFolderId) {
      return folders.filter((f) => f.parentId === currentFolderId);
    }
    return folders.filter((f) => !f.parentId);
  }, [folders, currentFolderId, searchQuery, activeSection]);

  // Count items inside a folder (notebooks + direct subfolders)
  const getFolderItemCount = (folderId: string) => {
    const nbCount = notebooks.filter((n) => n.folderId === folderId && !n.isTrash).length;
    const subCount = folders.filter((f) => f.parentId === folderId).length;
    return nbCount + subCount;
  };

  // Folder Operations
  const handleConfirmCreateFolder = async (name: string, color: string, colorName: string) => {
    await db.createFolder(name, color, colorName, currentFolderId);
    await reloadFolders();
    setIsCreateFolderOpen(false);
  };

  const handleConfirmEditFolder = async (name: string, color: string, colorName: string) => {
    if (!editingFolder) return;
    await db.updateFolder(editingFolder.id, { name, color, colorName });
    await reloadFolders();
    setEditingFolder(null);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    await db.deleteFolder(deletingFolder.id);
    await reloadFolders();
    setDeletingFolder(null);
  };

  const handleMoveNotebook = async (notebookId: string, targetFolderId: string | null) => {
    await db.moveNotebookToFolder(notebookId, targetFolderId);
    if (onMoveNotebookToFolder) {
      await onMoveNotebookToFolder(notebookId, targetFolderId);
    }
    setMovingNotebook(null);
  };

  const handleStartRename = (nb: Notebook) => {
    setEditingNotebook(nb);
    setNewTitle(nb.title);
  };

  const handleConfirmRename = () => {
    if (editingNotebook && newTitle.trim()) {
      onRenameNotebook(editingNotebook.id, newTitle.trim());
      setEditingNotebook(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingNotebook) {
      onDeleteNotebook(deletingNotebook.id);
      setDeletingNotebook(null);
    }
  };

  const handleQuickScratchpad = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    onCreateNotebook(
      `Scratchpad ${timeStr}`,
      "#1e3a8a",
      "solid",
      {
        type: "ruled",
        lineSpacing: 28,
        gridSize: 20,
        patternColor: "#cbd5e1",
        bgColor: "#ffffff",
      },
      "portrait",
      currentFolderId
    );
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categoriesList.includes(trimmed)) {
      setCategoriesList([...categoriesList, trimmed]);
      setSelectedCategory(trimmed);
      setNewCategoryName("");
      setIsNewCategoryOpen(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* NoteIn Authentic Sidebar (230px) */}
      <NoteinSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section);
          setCurrentFolderId(null);
        }}
        totalNotebooksCount={totalCount}
        recentCount={recentCount}
        favoritesCount={favoritesCount}
        trashCount={trashCount}
        googleUser={googleUser}
        folders={folders}
        currentFolderId={currentFolderId}
        notebooks={notebooks}
        onSelectFolder={(fId) => {
          setActiveSection("all");
          setCurrentFolderId(fId);
        }}
        onCreateFolderClick={() => setIsCreateFolderOpen(true)}
        onOpenDriveModal={() => {
          setGoogleUser(getGoogleUser());
          setIsDriveOpen(true);
        }}
        onOpenHelpModal={() => setIsHelpOpen(true)}
        onOpenAboutModal={() => setIsAboutOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {/* Top Navigation Bar (Search, Cloud Sync, View Toggles, New Folder) */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-secondary)",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Left: Mobile Menu Toggle & Search Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, maxWidth: "560px" }}>
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="notein-mobile-menu-btn"
              style={{
                padding: "8px",
                borderRadius: "8px",
                backgroundColor: "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "none",
              }}
              aria-label="Toggle Navigation Drawer"
            >
              <Menu size={20} />
            </button>

            {/* NoteIn Search Bar */}
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <NoteinSearch size={16} color="var(--text-muted)" />
              </div>
              <input
                type="text"
                placeholder="Search notes, folders or handwriting..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 38px 10px 40px",
                  borderRadius: "9999px",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3f52ff";
                  e.target.style.boxShadow = "0 0 0 3px rgba(63, 82, 255, 0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "12px",
                    backgroundColor: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Authentic New Folder Button */}
            <button
              id="notein-new-folder-header-btn"
              onClick={() => setIsCreateFolderOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Create New Folder (NoteIn APK)"
            >
              <NoteinFolderFill size={16} color="#007AFF" />
              <span>New Folder</span>
            </button>

            {/* Google Drive Cloud Sync Button */}
            <button
              id="google-drive-sync-btn"
              onClick={() => {
                setGoogleUser(getGoogleUser());
                setIsDriveOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "9999px",
                backgroundColor: googleUser ? "rgba(22, 163, 74, 0.08)" : "var(--bg-tertiary)",
                border: googleUser ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid var(--border-subtle)",
                color: googleUser ? "#16a34a" : "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Google Drive Cloud Sync"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleUser ? "Synced" : "Drive"}</span>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: googleUser ? "#16a34a" : "#94a3b8",
                }}
              />
            </button>

            {/* View Mode Toggle (Grid / List) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "8px",
                padding: "2px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <button
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: viewMode === "grid" ? "var(--bg-primary)" : "transparent",
                  color: viewMode === "grid" ? "#3f52ff" : "var(--text-muted)",
                  boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                title="Grid View"
              >
                <NoteinGridView size={17} color={viewMode === "grid" ? "#3f52ff" : "currentColor"} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: viewMode === "list" ? "var(--bg-primary)" : "transparent",
                  color: viewMode === "list" ? "#3f52ff" : "var(--text-muted)",
                  boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                title="List View"
              >
                <NoteinListView size={17} color={viewMode === "list" ? "#3f52ff" : "currentColor"} />
              </button>
            </div>

            {/* Filter / Sort Button with popover */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
                title="Sort & Filter"
              >
                <NoteinFilter size={16} />
                <span className="hide-on-mobile">Sort</span>
              </button>

              {showSortMenu && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 60 }}
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div
                    className="animate-scale-up"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: "6px",
                      width: "170px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      padding: "5px",
                      zIndex: 70,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {[
                      { id: "updatedAt" as SortBy, label: "Last Modified" },
                      { id: "title" as SortBy, label: "Title (A-Z)" },
                      { id: "pageCount" as SortBy, label: "Page Count" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id);
                          setShowSortMenu(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: sortBy === opt.id ? "rgba(63, 82, 255, 0.08)" : "transparent",
                          color: sortBy === opt.id ? "#3f52ff" : "var(--text-primary)",
                          fontWeight: sortBy === opt.id ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check size={14} color="#3f52ff" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Import Button */}
            <button
              onClick={() => setIsImportOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Import NoteIn Archive (.in/.notein), PDF, Images"
            >
              <Upload size={14} color="#3f52ff" />
              <span>Import</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Breadcrumb Navigation Bar (when inside a folder) */}
        {currentFolderId && (
          <div
            id="notein-folder-breadcrumb-bar"
            style={{
              padding: "12px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {/* Left: Back button & Breadcrumb path */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => {
                  if (currentFolder?.parentId) {
                    setCurrentFolderId(currentFolder.parentId);
                  } else {
                    setCurrentFolderId(null);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Back to parent"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              {/* Breadcrumb Trail */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <span
                  onClick={() => setCurrentFolderId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const nbId = e.dataTransfer.getData('text/plain');
                    if (nbId) handleMoveNotebook(nbId, null);
                  }}
                  style={{
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#007AFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  title="Click or drag note here to move to Desktop"
                >
                  Desktop
                </span>

                {breadcrumbTrail.map((f, idx) => {
                  const isLast = idx === breadcrumbTrail.length - 1;
                  return (
                    <React.Fragment key={f.id}>
                      <ChevronRight size={14} color="var(--text-muted)" />
                      {isLast ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "2px",
                              backgroundColor: f.color || "#4E5262",
                              display: "inline-block",
                            }}
                          />
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{f.name}</span>
                        </div>
                      ) : (
                        <span
                          onClick={() => setCurrentFolderId(f.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const nbId = e.dataTransfer.getData('text/plain');
                            if (nbId) handleMoveNotebook(nbId, f.id);
                          }}
                          style={{ color: "var(--text-muted)", cursor: "pointer" }}
                          title={`Click or drag note here to move to ${f.name}`}
                        >
                          {f.name}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Right: Quick actions inside this folder */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setIsCreateFolderOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Create Subfolder"
              >
                <FolderPlus size={14} color="#007AFF" />
                <span>+ Subfolder</span>
              </button>

              <button
                onClick={() => setIsCreateOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#007AFF",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0, 122, 255, 0.3)",
                }}
              >
                <Plus size={14} />
                <span>+ Notebook</span>
              </button>
            </div>
          </div>
        )}

        {/* Category Filter Chips Bar (only on root desktop) */}
        {!currentFolderId && (
          <div
            style={{
              padding: "16px 28px 8px 28px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              overflowX: "auto",
              userSelect: "none",
            }}
          >
            {categoriesList.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    fontWeight: isSelected ? 700 : 500,
                    backgroundColor: isSelected ? "#3f52ff" : "var(--bg-secondary)",
                    color: isSelected ? "#ffffff" : "var(--text-secondary)",
                    border: isSelected ? "1px solid #3f52ff" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(63, 82, 255, 0.25)" : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}

            {/* Add Category Chip */}
            <button
              onClick={() => setIsNewCategoryOpen(true)}
              style={{
                padding: "6px 10px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 500,
                backgroundColor: "transparent",
                color: "var(--text-muted)",
                border: "1px dashed var(--border-subtle)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
              title="Create new category tag"
            >
              <Plus size={12} />
              <span>Tag</span>
            </button>
          </div>
        )}

        {/* Active Folder Header Banner keeping folder color */}
        {currentFolder && (
          <div
            id="notein-active-folder-banner"
            style={{
              margin: "16px 28px 0 28px",
              padding: "14px 20px",
              borderRadius: "12px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: `5px solid ${currentFolder.color || "#4E5262"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  backgroundColor: `${currentFolder.color || "#4E5262"}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NoteinFolderFill size={20} color={currentFolder.color || "#4E5262"} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    {currentFolder.name}
                  </h2>
                  <button
                    onClick={() => setEditingFolder(currentFolder)}
                    style={{
                      border: "none",
                      backgroundColor: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Edit folder"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
                  {filteredNotebooks.length} {filteredNotebooks.length === 1 ? "document" : "documents"} inside this folder
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => setEditingFolder(currentFolder)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: currentFolder.color || "#4E5262",
                    display: "inline-block",
                  }}
                />
                <span>Change Color</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Shelf Container: Folders & Notebooks */}
        <main style={{ padding: "20px 28px 90px 28px", flex: 1 }}>
          {displayedFolders.length > 0 || filteredNotebooks.length > 0 ? (
            viewMode === "grid" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                  gap: "24px",
                }}
              >
                {/* 1. Folder Cards (matching NoteIn APK layout) */}
                {displayedFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    itemCount={getFolderItemCount(f.id)}
                    insideNotebooks={notebooks.filter((n) => n.folderId === f.id && !n.isTrash)}
                    viewMode="grid"
                    onOpen={(targetFolder) => setCurrentFolderId(targetFolder.id)}
                    onRename={(targetFolder) => setEditingFolder(targetFolder)}
                    onChangeColor={(targetFolder) => setEditingFolder(targetFolder)}
                    onDelete={(targetFolder) => setDeletingFolder(targetFolder)}
                    onDropNotebook={(notebookId, targetFolderId) => handleMoveNotebook(notebookId, targetFolderId)}
                  />
                ))}

                {/* 2. Notebook Cards */}
                {filteredNotebooks.map((nb) => (
                  <NotebookCard
                    key={nb.id}
                    notebook={nb}
                    onOpen={onOpenNotebook}
                    onRename={handleStartRename}
                    onDelete={(target) => setDeletingNotebook(target)}
                    onMoveToFolder={(target) => setMovingNotebook(target)}
                  />
                ))}
              </div>
            ) : (
              /* List View Mode */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-subtle)",
                  padding: "8px",
                }}
              >
                {/* Folder List Items */}
                {displayedFolders.map((f) => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    itemCount={getFolderItemCount(f.id)}
                    insideNotebooks={notebooks.filter((n) => n.folderId === f.id && !n.isTrash)}
                    viewMode="list"
                    onOpen={(targetFolder) => setCurrentFolderId(targetFolder.id)}
                    onRename={(targetFolder) => setEditingFolder(targetFolder)}
                    onChangeColor={(targetFolder) => setEditingFolder(targetFolder)}
                    onDelete={(targetFolder) => setDeletingFolder(targetFolder)}
                    onDropNotebook={(notebookId, targetFolderId) => handleMoveNotebook(notebookId, targetFolderId)}
                  />
                ))}

                {/* Notebook List Items */}
                {filteredNotebooks.map((nb) => (
                  <div
                    key={nb.id}
                    onClick={() => onOpenNotebook(nb)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "42px",
                          borderRadius: "4px",
                          backgroundColor: "#ffffff",
                          border: "1px solid rgba(0,0,0,0.12)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-around",
                          padding: "5px 4px",
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ height: "2px", backgroundColor: "#e2e8f0", borderRadius: "1px" }} />
                        <div style={{ height: "2px", backgroundColor: "#e2e8f0", borderRadius: "1px" }} />
                        <div style={{ height: "2px", backgroundColor: "#e2e8f0", borderRadius: "1px" }} />
                        <div style={{ height: "2px", backgroundColor: "#e2e8f0", borderRadius: "1px" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(nb);
                          }}
                          title="Click to rename document"
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
                            {nb.title}
                          </span>
                          <Edit2 size={12} color="var(--text-muted)" style={{ opacity: 0.65 }} />
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {nb.defaultTemplate.type} paper • {nb.pageCount || 1} pages •{" "}
                          {nb.strokeCount ? `${nb.strokeCount.toLocaleString()} strokes` : "Synced"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingNotebook(nb);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-subtle)",
                          backgroundColor: "var(--bg-tertiary)",
                          color: "var(--text-secondary)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Move
                      </button>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {new Date(nb.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Empty State */
            <div
              className="animate-scale-up"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "72px 20px",
                textAlign: "center",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "16px",
                border: "2px dashed var(--border-subtle)",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: currentFolderId ? `${currentFolder?.color || "#007AFF"}22` : "rgba(63, 82, 255, 0.1)",
                  color: currentFolderId ? currentFolder?.color || "#007AFF" : "#3f52ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                {currentFolderId ? <NoteinFolderFill size={32} color={currentFolder?.color || "#007AFF"} /> : <Sparkles size={28} />}
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
                {searchQuery
                  ? "No notes or folders found"
                  : currentFolderId
                  ? `Folder "${currentFolder?.name}" is empty`
                  : "No documents in this view"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "380px", marginBottom: "20px" }}>
                {searchQuery
                  ? `No documents match "${searchQuery}". Check spelling or select another category.`
                  : currentFolderId
                  ? "Create notebooks or subfolders inside this folder, or move existing notebooks here from the desktop."
                  : "Create a new document, folder, or import your existing NoteIn Android backup archives to begin."}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => setIsCreateFolderOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "9999px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <NoteinFolderFill size={16} color="#007AFF" />
                  New Folder
                </button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    borderRadius: "9999px",
                    backgroundColor: "#3f52ff",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    boxShadow: "0 4px 14px rgba(63, 82, 255, 0.35)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={16} />
                  New Notebook
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Authentic NoteIn Floating Action Menu (FAB - fragment_fab_note_type.xml) */}
      <div
        style={{
          position: "fixed",
          right: "28px",
          bottom: "28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          zIndex: 80,
        }}
      >
        {/* Authentic FAB Popup Drawer (fragment_fab_note_type.xml) */}
        {isFabMenuOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 75 }}
              onClick={() => setIsFabMenuOpen(false)}
            />
            <div
              className="animate-scale-up"
              style={{
                position: "absolute",
                bottom: "70px",
                right: 0,
                width: "220px",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "16px",
                boxShadow: "0 12px 32px rgba(0, 0, 0, 0.22), 0 0 0 1px var(--border-subtle)",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                zIndex: 85,
              }}
            >
              {/* Option 1: Standard Notebook (cl_create_note) */}
              <button
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setIsCreateOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(63, 82, 255, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileText size={16} color="#3f52ff" />
                </div>
                <span>New Notebook</span>
              </button>

              {/* Option 2: Folder (cl_create_folder - fragment_folder_creation_dialog.xml) */}
              <button
                id="fab-create-folder-btn"
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setIsCreateFolderOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
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
                  <NoteinFolderFill size={16} color="#007AFF" />
                </div>
                <span>New Folder</span>
              </button>

              {/* Option 3: Import Documents (cl_import_documents) */}
              <button
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setIsImportOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Upload size={15} color="#10b981" />
                </div>
                <span>Import Document</span>
              </button>
            </div>
          </>
        )}

        {/* Quick Pen Scratchpad FAB */}
        <button
          onClick={handleQuickScratchpad}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
            color: "#3f52ff",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.18s ease, box-shadow 0.18s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.12)";
          }}
          title="Instant Quick Scratchpad Note"
          aria-label="Create Scratchpad"
        >
          <NoteinEdit size={20} color="#3f52ff" />
        </button>

        {/* Primary Creation FAB (Toggles NoteIn FAB Menu) */}
        <button
          id="notein-main-fab-btn"
          onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "#3f52ff",
            border: "none",
            color: "#ffffff",
            boxShadow: "0 6px 20px rgba(63, 82, 255, 0.42)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.18s ease, box-shadow 0.18s ease",
            transform: isFabMenuOpen ? "rotate(45deg)" : "none",
          }}
          onMouseEnter={(e) => {
            if (!isFabMenuOpen) e.currentTarget.style.transform = "scale(1.06)";
            e.currentTarget.style.boxShadow = "0 8px 26px rgba(63, 82, 255, 0.52)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = isFabMenuOpen ? "rotate(45deg)" : "scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(63, 82, 255, 0.42)";
          }}
          title="Create New (Notebook, Folder, Import)"
          aria-label="New Note or Folder"
        >
          <NoteinAdd size={24} color="#ffffff" />
        </button>
      </div>

      {/* Authentic NoteIn Create Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen || Boolean(editingFolder)}
        initialName={editingFolder ? editingFolder.name : ""}
        initialColor={editingFolder ? editingFolder.color : "#4E5262"}
        isEditMode={Boolean(editingFolder)}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setEditingFolder(null);
        }}
        onConfirm={(name, color, colorName) => {
          if (editingFolder) {
            handleConfirmEditFolder(name, color, colorName);
          } else {
            handleConfirmCreateFolder(name, color, colorName);
          }
        }}
      />

      {/* Authentic NoteIn Move to Folder Modal */}
      <MoveToFolderModal
        isOpen={Boolean(movingNotebook)}
        notebook={movingNotebook}
        folders={folders}
        onClose={() => setMovingNotebook(null)}
        onMove={handleMoveNotebook}
        onCreateFolder={async (name, color, colorName) => {
          const created = await db.createFolder(name, color, colorName, currentFolderId);
          await reloadFolders();
          return created;
        }}
      />

      {/* Delete Folder Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
        title="Delete Folder"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Are you sure you want to delete folder{" "}
            <strong style={{ color: "var(--text-primary)" }}>{deletingFolder?.name}</strong>? Any
            notebooks inside this folder will be safely moved to Desktop (All Documents).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setDeletingFolder(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeleteFolder}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete Folder
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Notebook Modal */}
      <CreateNotebookModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={(title, color, pattern, template, orientation) => {
          onCreateNotebook(title, color, pattern, template, orientation, currentFolderId);
          setIsCreateOpen(false);
        }}
      />

      {/* Rename Notebook Modal */}
      <Modal
        isOpen={Boolean(editingNotebook)}
        onClose={() => setEditingNotebook(null)}
        title="Rename Document"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Document Title
            </label>
            <input
              id="rename-notebook-input"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Physics Notes"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "14px",
                marginTop: "6px",
                outline: "none",
              }}
              autoFocus
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
                if (e.key === "Escape") setEditingNotebook(null);
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setEditingNotebook(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              id="confirm-rename-notebook-btn"
              onClick={handleConfirmRename}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#3f52ff",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingNotebook)}
        onClose={() => setDeletingNotebook(null)}
        title="Delete Document"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Are you sure you want to delete{" "}
            <strong style={{ color: "var(--text-primary)" }}>{deletingNotebook?.title}</strong>? All
            pages, vector strokes, and handwritten data will be permanently removed.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setDeletingNotebook(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isNewCategoryOpen}
        onClose={() => setIsNewCategoryOpen(false)}
        title="Create Category Tag"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Category Name
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Mathematics, Calculus, Journal"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "14px",
                marginTop: "6px",
                outline: "none",
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
                if (e.key === "Escape") setIsNewCategoryOpen(false);
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              onClick={() => setIsNewCategoryOpen(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddCategory}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#3f52ff",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Tag
            </button>
          </div>
        </div>
      </Modal>

      {/* Help & Feedback Modal */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Help & Feedback"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", color: "var(--text-secondary)" }}>
          <p>
            NoteIn Web is designed to mirror the authentic NoteIn Android application workflow.
          </p>
          <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "12px", borderRadius: "8px" }}>
            <strong style={{ color: "var(--text-primary)" }}>Tips:</strong>
            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
              <li>Create folders with custom NoteIn cover colors and folder straps.</li>
              <li>Move notebooks between folders using the 3-dot menu on any document.</li>
              <li>Drag & drop any NoteIn Android archive or Google Drive backup directly onto the screen.</li>
              <li>Use the quick pen button in the bottom right for instant scratchpad notes.</li>
            </ul>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setIsHelpOpen(false)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#3f52ff",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>

      {/* About NoteIn Modal */}
      <Modal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        title="About NoteIn"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px", color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/notein_logo.webp" alt="NoteIn" style={{ width: "48px", height: "48px", borderRadius: "10px" }} />
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>NoteIn Studio</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Version 2.1.27.0 Global Architecture</div>
            </div>
          </div>
          <p>
            Authentic NoteIn layout, folder system with color customization, vector ink rendering engine, and universal document parser supporting Google Drive archives, SQLite databases, and stroke vector geometry.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setIsAboutOpen(false)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#3f52ff",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Google Drive Integration Modal */}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => {
          setIsDriveOpen(false);
          setGoogleUser(getGoogleUser());
        }}
        onImportComplete={(nb) => {
          if (onImportNotebook) {
            onImportNotebook(nb);
          }
        }}
      />

      {/* Import Document Modal */}
      <ImportDocumentModal
        isOpen={isImportOpen}
        initialFile={droppedFile}
        onClose={() => {
          setIsImportOpen(false);
          setDroppedFile(null);
        }}
        onImportSuccess={(newNotebook) => {
          if (onImportNotebook) {
            onImportNotebook(newNotebook);
          }
        }}
      />
    </div>
  );
};
