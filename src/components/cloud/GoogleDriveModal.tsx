// NoteIn Web - Google Drive Cloud Sync & Browser Modal
// Professional consumer-facing Google Drive integration:
// Sign in with Google -> Browse & Open files directly from Drive -> Back up notebooks to Drive

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GoogleUser, Notebook, Stroke, TextBox } from '../../types';
import {
  getGoogleUser,
  signOutFromGoogle,
  initializeGoogleIdentity,
  renderGoogleSignInButton,
  downloadDriveFile,
  listDriveFiles,
  getGoogleClientId,
  uploadNotebookToGoogleDrive,
  type GooglePickedFile,
} from '../../services/googleDriveService';
import { importAnyDocument } from '../../services/documentImporter';
import { db } from '../../db';
import {
  X,
  HardDrive,
  LogOut,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  File as FileGeneric,
  CloudUpload,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (notebook: Notebook) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(name: string, mimeType: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.notein') || lower.endsWith('.in')) {
    return <HardDrive size={18} color="#3f52ff" />;
  }
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    return <FileText size={18} color="#ef4444" />;
  }
  if (mimeType.startsWith('application/vnd.google-apps.document')) {
    return <FileText size={18} color="#2563eb" />;
  }
  if (mimeType.startsWith('image/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp')) {
    return <ImageIcon size={18} color="#16a34a" />;
  }
  return <FileGeneric size={18} color="var(--text-muted)" />;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => getGoogleUser());
  const [clientId] = useState(() => getGoogleClientId());

  // Drive files & search
  const [driveFiles, setDriveFiles] = useState<GooglePickedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Importing & backup states
  const [importingFileName, setImportingFileName] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentImports, setRecentImports] = useState<Array<{ name: string; importedAt: string }>>([]);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Load files from Google Drive
  const loadFiles = useCallback(async (query?: string) => {
    setIsLoadingFiles(true);
    setErrorMessage(null);
    try {
      const files = await listDriveFiles(query);
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Load drive files error:', err);
      setErrorMessage(err?.message || 'Could not list files from Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // When opened or signed in
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeUser = getGoogleUser();
    setCurrentUser(activeUser);

    if (clientId) {
      initializeGoogleIdentity(
        (user) => {
          setCurrentUser(user);
          setSuccessMessage(`Signed in as ${user.name}`);
          setErrorMessage(null);
        },
        (error) => {
          console.warn('GIS error:', error);
          if (!activeUser) {
            setErrorMessage(error);
          }
        }
      );
    }

    if (activeUser) {
      loadFiles();
    }
  }, [isOpen, clientId, loadFiles]);

  // Render Google Sign-In button if user not logged in
  useEffect(() => {
    if (!isOpen || currentUser) return;

    const timer = setTimeout(() => {
      if (googleBtnContainerRef.current && clientId) {
        renderGoogleSignInButton(googleBtnContainerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 280,
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, currentUser, clientId]);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    try {
      await signOutFromGoogle();
      setCurrentUser(null);
      setDriveFiles([]);
      setSuccessMessage('Signed out of Google account.');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Failed to sign out: ${err?.message || err}`);
    }
  };

  const handleImportFile = async (file: GooglePickedFile) => {
    setImportingFileName(file.name);
    setErrorMessage(null);
    setImportProgress(null);

    try {
      const downloaded = await downloadDriveFile(file);
      const result = await importAnyDocument(
        {
          data: downloaded.data,
          filename: downloaded.filename,
          mimeType: downloaded.mimeType,
        },
        (current, total) => {
          setImportProgress({ current, total });
        }
      );

      setRecentImports((prev) => [
        { name: file.name, importedAt: new Date().toLocaleTimeString() },
        ...prev.slice(0, 4),
      ]);
      setSuccessMessage(`Successfully imported "${result.notebook.title}" into NoteIn!`);
      onImportComplete(result.notebook);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import selected file from Google Drive.');
    } finally {
      setImportingFileName(null);
      setImportProgress(null);
    }
  };

  const handleBackupAllNotebooks = async () => {
    setIsBackingUp(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const notebooks = await db.notebooks.toArray();
      if (notebooks.length === 0) {
        setErrorMessage('No notebooks found to back up.');
        setIsBackingUp(false);
        return;
      }

      let count = 0;
      for (const nb of notebooks) {
        const pages = await db.pages.where('notebookId').equals(nb.id).sortBy('pageNumber');
        const allStrokes: Stroke[] = [];
        const allTextBoxes: TextBox[] = [];
        for (const p of pages) {
          const s = await db.strokes.where('pageId').equals(p.id).toArray();
          const tb = await db.textBoxes.where('pageId').equals(p.id).toArray();
          allStrokes.push(...s);
          allTextBoxes.push(...tb);
        }
        await uploadNotebookToGoogleDrive(nb, pages, allStrokes, allTextBoxes);
        count++;
      }

      setSuccessMessage(`✓ Successfully backed up ${count} notebook(s) to your Google Drive!`);
      loadFiles();
    } catch (err: any) {
      setErrorMessage(`Backup to Google Drive failed: ${err?.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const filteredFiles = driveFiles.filter((f) => {
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(66, 133, 244, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HardDrive size={20} color="#4285f4" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Google Drive Cloud Storage
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Open notes, PDFs &amp; documents or back up your library
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Notifications */}
          {errorMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                color: '#16a34a',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Active Import Progress */}
          {importingFileName && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(63, 82, 255, 0.08)',
                border: '1px solid rgba(63, 82, 255, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" color="#3f52ff" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Opening "{importingFileName}"...
                  </span>
                </div>
                {importProgress && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Page {importProgress.current} / {importProgress.total}
                  </span>
                )}
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--bg-tertiary)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#3f52ff',
                    width: importProgress ? `${(importProgress.current / importProgress.total) * 100}%` : '50%',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* STATE 1: NOT LOGGED IN */}
          {!currentUser ? (
            <div
              style={{
                padding: '36px 20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(66, 133, 244, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={30} color="#4285f4" />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  Connect with Google Drive
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '400px', lineHeight: 1.5 }}>
                  Sign in with your Google account to access your notes, PDFs, and documents directly in NoteIn Web.
                </p>
              </div>

              <div
                ref={googleBtnContainerRef}
                style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </div>
          ) : (
            /* STATE 2: LOGGED IN */
            <>
              {/* User Profile Bar */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {currentUser.picture ? (
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#3f52ff',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 700,
                      }}
                    >
                      {currentUser.name.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {currentUser.name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(22, 163, 74, 0.12)',
                          color: '#16a34a',
                        }}
                      >
                        Connected
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentUser.email}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleBackupAllNotebooks}
                    disabled={isBackingUp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isBackingUp ? 'not-allowed' : 'pointer',
                    }}
                    title="Upload backup of all notebooks to Google Drive"
                  >
                    {isBackingUp ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} color="#3f52ff" />}
                    <span>{isBackingUp ? 'Backing Up...' : 'Backup Notebooks'}</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    title="Sign Out from Google"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Google Drive File Browser */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderOpen size={16} color="#3f52ff" />
                    <span>Files in Google Drive</span>
                  </h3>

                  <button
                    onClick={() => loadFiles(searchQuery)}
                    disabled={isLoadingFiles}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: isLoadingFiles ? 'not-allowed' : 'pointer',
                    }}
                    title="Reload files from Google Drive"
                  >
                    <RefreshCw size={12} className={isLoadingFiles ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      loadFiles(e.target.value);
                    }}
                    placeholder="Search files by name..."
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* File List */}
                <div
                  style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginTop: '4px',
                  }}
                >
                  {isLoadingFiles ? (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <Loader2 size={24} className="animate-spin" color="#3f52ff" style={{ margin: '0 auto 8px auto' }} />
                      <span>Loading your Google Drive files...</span>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {searchQuery ? 'No matching files found in Drive.' : 'No files found in your Google Drive.'}
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          transition: 'background-color 0.15s ease',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          {getFileIcon(file.name, file.mimeType)}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={file.name}
                            >
                              {file.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                              {file.sizeBytes ? <span>{formatBytes(file.sizeBytes)}</span> : null}
                              {file.lastEditedUtc ? <span>{formatDate(file.lastEditedUtc)}</span> : null}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleImportFile(file)}
                          disabled={!!importingFileName}
                          style={{
                            flexShrink: 0,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#3f52ff',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: importingFileName ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Open
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Imports list */}
              {recentImports.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Recently Opened
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    {recentImports.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-primary)',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileCheck size={14} color="#16a34a" />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.importedAt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
