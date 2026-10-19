// Official Google Identity Services & Google Drive Picker Modal
// Supports Real Google Sign-In, Live Google Drive Picker (drive.file scope), and Document Import

import React, { useState, useEffect, useRef } from 'react';
import type { GoogleUser, Notebook } from '../../types';
import {
  getGoogleUser,
  signOutFromGoogle,
  initializeGoogleIdentity,
  renderGoogleSignInButton,
  openGoogleDrivePicker,
  downloadDriveFile,
  getCredentialStatus,
  saveUserGoogleCredentials,
  clearUserGoogleCredentials,
  type GooglePickedFile,
} from '../../services/googleDriveService';
import { importAnyDocument } from '../../services/documentImporter';
import {
  X,
  HardDrive,
  Key,
  LogOut,
  FolderOpen,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileCheck,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (notebook: Notebook) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => getGoogleUser());
  const [credStatus, setCredStatus] = useState(() => getCredentialStatus());
  const [showConfigSettings, setShowConfigSettings] = useState(false);

  // Form states for manual credentials entry
  const [inputClientId, setInputClientId] = useState(credStatus.clientId);
  const [inputApiKey, setInputApiKey] = useState(credStatus.apiKey);
  const [inputAppId, setInputAppId] = useState(credStatus.appId);

  // Operation states
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentImports, setRecentImports] = useState<Array<{ name: string; size?: number; importedAt: string }>>([]);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Refresh credentials status & initialize GIS when opened
  useEffect(() => {
    if (!isOpen) return;

    const status = getCredentialStatus();
    setCredStatus(status);
    setInputClientId(status.clientId);
    setInputApiKey(status.apiKey);
    setInputAppId(status.appId);
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeUser = getGoogleUser();
    setCurrentUser(activeUser);

    // If client ID is present, initialize GIS
    if (status.clientId) {
      initializeGoogleIdentity(
        (user) => {
          setCurrentUser(user);
          setSuccessMessage(`Signed in as ${user.name} (${user.email})`);
          setErrorMessage(null);
        },
        (error) => {
          console.warn('GIS info/error:', error);
          if (!activeUser) {
            setErrorMessage(error);
          }
        }
      );
    }
  }, [isOpen]);

  // Render official Google button when needed
  useEffect(() => {
    if (!isOpen || currentUser) return;

    const timer = setTimeout(() => {
      if (googleBtnContainerRef.current && credStatus.clientId) {
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
  }, [isOpen, currentUser, credStatus.clientId]);

  if (!isOpen) return null;

  // Handle saving credentials entered in the UI
  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!inputClientId.trim()) {
      setErrorMessage('Please provide an OAuth 2.0 Client ID.');
      return;
    }
    if (!inputApiKey.trim()) {
      setErrorMessage('Please provide a Google API Key.');
      return;
    }

    saveUserGoogleCredentials(inputClientId, inputApiKey, inputAppId);
    const updated = getCredentialStatus();
    setCredStatus(updated);
    setSuccessMessage('Google Cloud credentials updated successfully!');
    setShowConfigSettings(false);

    // Re-initialize GIS
    initializeGoogleIdentity(
      (user) => {
        setCurrentUser(user);
        setSuccessMessage(`Signed in as ${user.name}`);
      },
      (error) => setErrorMessage(error)
    );

    // Re-render button
    setTimeout(() => {
      if (googleBtnContainerRef.current) {
        renderGoogleSignInButton(googleBtnContainerRef.current);
      }
    }, 100);
  };

  const handleClearCredentials = () => {
    clearUserGoogleCredentials();
    const updated = getCredentialStatus();
    setCredStatus(updated);
    setInputClientId('');
    setInputApiKey('');
    setInputAppId('');
    setSuccessMessage('Saved credentials cleared.');
  };

  const handleSignOut = async () => {
    try {
      await signOutFromGoogle();
      setCurrentUser(null);
      setSuccessMessage('Signed out of Google account.');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Failed to sign out: ${err?.message || err}`);
    }
  };

  // Launch the official Google Drive Picker
  const handleOpenGooglePicker = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!credStatus.isFullyConfigured) {
      setShowConfigSettings(true);
      setErrorMessage('Google Client ID and API Key must be configured to open Google Picker.');
      return;
    }

    setIsOpeningPicker(true);

    try {
      await openGoogleDrivePicker({
        onPicked: async (pickedFiles: GooglePickedFile[]) => {
          setIsOpeningPicker(false);
          if (!pickedFiles || pickedFiles.length === 0) return;

          for (const picked of pickedFiles) {
            await handleImportPickedFile(picked);
          }
        },
        onCancel: () => {
          setIsOpeningPicker(false);
        },
        onError: (err: Error) => {
          setIsOpeningPicker(false);
          setErrorMessage(err.message || 'Google Drive Picker error occurred.');
        },
      });
    } catch (err: any) {
      setIsOpeningPicker(false);
      setErrorMessage(err.message || 'Failed to initialize Google Drive Picker.');
    }
  };

  // Download real file from Drive API v3 and import into NoteIn Web
  const handleImportPickedFile = async (file: GooglePickedFile) => {
    setImportingFileName(file.name);
    setErrorMessage(null);
    setImportProgress(null);

    try {
      // 1. Download real file contents via Google Drive API v3
      const downloaded = await downloadDriveFile(file);

      // 2. Import into NoteIn Web
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
        { name: downloaded.filename, size: file.sizeBytes, importedAt: new Date().toLocaleTimeString() },
        ...prev.slice(0, 4),
      ]);

      setSuccessMessage(
        `Successfully imported "${result.notebook.title}" (${result.pages.length} ${
          result.pages.length === 1 ? 'page' : 'pages'
        }) into NoteIn!`
      );

      // Notify parent to open or refresh
      onImportComplete(result.notebook);
    } catch (err: any) {
      console.error('Import failed:', err);
      setErrorMessage(`Could not import "${file.name}": ${err?.message || err}`);
    } finally {
      setImportingFileName(null);
      setImportProgress(null);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !importingFileName && !isOpeningPicker) {
          onClose();
        }
      }}
    >
      <div
        className="animate-scale-up"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <HardDrive size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Google Drive & Identity Integration
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Official Google Identity Services &amp; Google Picker API
              </p>
            </div>
          </div>
          <button
            id="close-google-drive-modal-btn"
            onClick={onClose}
            disabled={!!importingFileName || isOpeningPicker}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Notifications / Alerts */}
          {errorMessage && (
            <div
              className="animate-fade-in"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div
              className="animate-fade-in"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                color: '#16a34a',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* SECTION 1: AUTHENTICATED USER OR SIGN-IN */}
          <div
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  {currentUser.picture ? (
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        border: '2px solid var(--accent-primary)',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                      }}
                    >
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {currentUser.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(22, 163, 74, 0.15)',
                          color: '#16a34a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {currentUser.email}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center', padding: '10px 0' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Sign in with Google
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px' }}>
                    Connect your real Google account using Google Identity Services to access Drive files.
                  </p>
                </div>

                {/* Always Rendered Official Google Sign-In Button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  {credStatus.hasClientId ? (
                    <div
                      ref={googleBtnContainerRef}
                      style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    />
                  ) : (
                    <button
                      id="continue-with-google-btn"
                      type="button"
                      onClick={() => setShowConfigSettings(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 24px',
                        backgroundColor: '#ffffff',
                        color: '#3c4043',
                        border: '1px solid #dadce0',
                        borderRadius: '24px',
                        fontSize: '14px',
                        fontWeight: 500,
                        boxShadow: '0 1px 3px rgba(60,64,67, 0.15)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafd';
                        e.currentTarget.style.boxShadow = '0 1px 4px rgba(60,64,67, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67, 0.15)';
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  )}
                  {!credStatus.hasClientId && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Click to link your Google Client ID for this local dev app
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: OPEN FROM GOOGLE DRIVE (GOOGLE PICKER API) */}
          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen size={18} color="var(--accent-primary)" />
                  Open Files via Google Picker
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Browse your real Google Drive with Google's official File Picker dialog.
                  Selecting a file grants per-file permission (<code style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 5px', borderRadius: '4px' }}>drive.file</code> scope).
                </p>
              </div>
            </div>

            {/* Launch Picker Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleOpenGooglePicker}
                disabled={isOpeningPicker || !!importingFileName || !credStatus.isFullyConfigured}
                style={{
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: !credStatus.isFullyConfigured ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                  color: !credStatus.isFullyConfigured ? 'var(--text-muted)' : '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: !credStatus.isFullyConfigured ? 'not-allowed' : 'pointer',
                  border: 'none',
                  boxShadow: credStatus.isFullyConfigured ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isOpeningPicker ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Launching Google Picker...
                  </>
                ) : (
                  <>
                    <FolderOpen size={16} />
                    Open from Google Drive
                  </>
                )}
              </button>

              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Supports NoteIn packages (.notein, .in), PDF, Google Docs, Images, Markdown, and Text.
              </span>
            </div>

            {/* Active Import Progress */}
            {importingFileName && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Downloading &amp; Parsing "{importingFileName}"...
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
                      backgroundColor: 'var(--accent-primary)',
                      width: importProgress ? `${(importProgress.current / importProgress.total) * 100}%` : '50%',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Recent Imports in Current Session */}
            {recentImports.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Recently Opened from Drive
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {recentImports.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-secondary)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileCheck size={14} color="#16a34a" />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.importedAt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: CREDENTIALS & GOOGLE CLOUD CONFIGURATION */}
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setShowConfigSettings(!showConfigSettings)}
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Google Cloud Credentials &amp; API Setup
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: credStatus.isFullyConfigured ? 'rgba(22, 163, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: credStatus.isFullyConfigured ? '#16a34a' : '#dc2626',
                  }}
                >
                  {credStatus.isFullyConfigured ? 'Configured' : 'Setup Required'}
                </span>
              </div>
              {showConfigSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showConfigSettings && (
              <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '14px 0 12px 0', lineHeight: 1.5 }}>
                  Google Identity Services and Google Picker API require a valid OAuth 2.0 Client ID and API Key from your Google Cloud Console.
                  Credentials can be supplied via environment variables in <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>.env.local</code> or entered directly below for local testing.
                </p>

                <form onSubmit={handleSaveCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      OAuth 2.0 Web Client ID (VITE_GOOGLE_CLIENT_ID)
                    </label>
                    <input
                      type="text"
                      placeholder="1234567890-abcdef.apps.googleusercontent.com"
                      value={inputClientId}
                      onChange={(e) => setInputClientId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Google API Key for Picker (VITE_GOOGLE_API_KEY)
                    </label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Google Cloud Project Number / App ID (VITE_GOOGLE_APP_ID, optional)
                    </label>
                    <input
                      type="text"
                      placeholder="1234567890 (derived automatically if left blank)"
                      value={inputAppId}
                      onChange={(e) => setInputAppId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={handleClearCredentials}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear Saved
                    </button>

                    <button
                      type="submit"
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Save &amp; Apply Credentials
                    </button>
                  </div>
                </form>

                {/* Helpful Checklist & Instructions */}
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    Google Cloud Console Checklist:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    <li>
                      <strong>Enable APIs:</strong> Google Drive API &amp; Google Picker API
                    </li>
                    <li>
                      <strong>Authorized JavaScript Origin:</strong>{' '}
                      <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: '3px' }}>
                        {currentOrigin}
                      </code>
                    </li>
                    <li>
                      <strong>OAuth Consent Screen:</strong> In testing mode, add your Google account to Test Users.
                    </li>
                    <li>
                      <strong>Scope:</strong> <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: '3px' }}>https://www.googleapis.com/auth/drive.file</code>
                    </li>
                  </ul>
                  <a
                    href="https://console.cloud.google.com/apis/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--accent-primary)',
                      marginTop: '8px',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Open Google Cloud Console <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
