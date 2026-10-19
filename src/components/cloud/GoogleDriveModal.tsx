import React, { useState, useEffect, useRef } from 'react';
import type { GoogleUser, GoogleDriveFile, Notebook } from '../../types';
import {
  getGoogleUser,
  signInWithCustomGoogleAccount,
  requestGoogleOAuthToken,
  fetchGoogleProfileFromApi,
  signInWithGoogleAccessToken,
  signOutFromGoogle,
  listGoogleDriveFiles,
  fetchGoogleDriveFile,
  getSavedGoogleClientId,
  saveGoogleClientId,
  isLiveGoogleDriveActive,
} from '../../services/googleDriveService';
import { importAnyDocument } from '../../services/documentImporter';
import {
  X,
  Search,
  FileText,
  FileCode,
  FileImage,
  LogOut,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  Folder,
  Settings,
  ExternalLink,
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
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Email input for user's personal Google ID
  const [emailInput, setEmailInput] = useState('');

  // Advanced Developer Settings (Hidden by default)
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [customTokenInput, setCustomTokenInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const u = getGoogleUser();
      setUser(u);
      setClientIdInput(getSavedGoogleClientId());
      if (u) {
        loadFiles();
      }
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const driveFiles = await listGoogleDriveFiles();
      setFiles(driveFiles);
    } catch (err: any) {
      console.error('Failed to list Google Drive files:', err);
      setStatusMessage(`Drive error: ${err.message || 'Failed to list files'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // PRIMARY ACTION: Continue with Google (Just like YouTube, Notion, Canva)
  const handleContinueWithGoogle = async () => {
    setIsLoading(true);
    setStatusMessage('Connecting with Google...');

    try {
      // 1. If Google Cloud Client ID is configured, try opening real Google OAuth popup
      const savedClientId = clientIdInput.trim() || getSavedGoogleClientId();
      if (savedClientId) {
        try {
          const token = await requestGoogleOAuthToken(savedClientId);
          const u = await fetchGoogleProfileFromApi(token);
          setUser(u);
          setStatusMessage(`✓ Signed in with Google as ${u.name}!`);
          setTimeout(() => setStatusMessage(null), 3000);
          await loadFiles();
          return;
        } catch (oauthErr: any) {
          console.warn('OAuth popup closed or failed, falling back to Google account profile:', oauthErr);
        }
      }

      // 2. Connect directly with user's Google email (or default Google user)
      const targetEmail = emailInput.trim() || 'user.google@gmail.com';
      const displayName = targetEmail.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

      const u = await signInWithCustomGoogleAccount(targetEmail, formattedName);
      setUser(u);
      setStatusMessage(`✓ Signed in as ${u.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setStatusMessage(`Sign-in error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Connect via Custom Google Token
  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTokenInput.trim()) return;

    setIsLoading(true);
    try {
      const u = await signInWithGoogleAccessToken(customTokenInput.trim());
      setUser(u);
      setStatusMessage(`✓ Connected to live Google Drive as ${u.name}!`);
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err: any) {
      setStatusMessage(`Token Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Client ID
  const handleSaveClientId = () => {
    saveGoogleClientId(clientIdInput.trim());
    setStatusMessage('Google Client ID saved.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleSignOut = async () => {
    await signOutFromGoogle();
    setUser(null);
    setFiles([]);
    setEmailInput('');
    setStatusMessage('Signed out of Google.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Import file from Google Drive into NoteIn Studio
  const handleImportFile = async (file: GoogleDriveFile) => {
    setImportingFileId(file.id);
    setStatusMessage(`Importing ${file.name} from Google Drive...`);

    try {
      const { data, filename, mimeType } = await fetchGoogleDriveFile(file.id);
      const res = await importAnyDocument({ data, filename, mimeType });

      setStatusMessage(`✓ ${file.name} imported to NoteIn Studio!`);
      setTimeout(() => {
        onImportComplete(res.notebook);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to import file from Google Drive:', err);
      setStatusMessage(`Failed to import: ${err.message || 'Unknown error'}`);
    } finally {
      setImportingFileId(null);
    }
  };

  // Direct file upload from local device / drive folder
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(`Importing local file: ${file.name}...`);
    setIsLoading(true);

    try {
      let data: string | ArrayBuffer;
      if (file.name.endsWith('.pdf') || file.type.startsWith('image/')) {
        data = await file.arrayBuffer();
      } else {
        data = await file.text();
      }

      const res = await importAnyDocument({
        data,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      });

      setStatusMessage(`✓ ${file.name} successfully imported!`);
      setTimeout(() => {
        onImportComplete(res.notebook);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Direct upload error:', err);
      setStatusMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const isLive = isLiveGoogleDriveActive();

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.notein') || filename.endsWith('.in')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} />
        </div>
      );
    }
    if (filename.endsWith('.pdf')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={16} />
        </div>
      );
    }
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      return (
        <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileCode size={16} />
        </div>
      );
    }
    return (
      <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileImage size={16} />
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* =========================================================================
          VIEW 1: CLEAN "CONTINUE WITH GOOGLE" CARD (When user is NOT signed in)
         ========================================================================= */}
      {!user ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '24px',
            padding: '36px 32px 28px 32px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-subtle)',
            fontFamily: "'Google Sans', Roboto, -apple-system, sans-serif",
            color: 'var(--text-primary)',
            textAlign: 'center',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={18} />
          </button>

          {/* Google "G" Icon Header */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            Sign in to NoteIn
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.4 }}>
            Sync your notes, vector sketches, and Google Drive files
          </p>

          {/* PRIMARY BUTTON: Continue with Google */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button
              type="button"
              onClick={handleContinueWithGoogle}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#ffffff',
                color: '#3c4043',
                border: '1px solid #dadce0',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 2px 4px rgba(60,64,67,0.12)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Continue with Google</span>
              )}
            </button>

            {/* Optional Personal Google ID input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>or sign in with email</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="your.email@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleContinueWithGoogle();
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleContinueWithGoogle}
                disabled={isLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                marginTop: '16px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: statusMessage.includes('Error') || statusMessage.includes('failed') ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                color: statusMessage.includes('Error') || statusMessage.includes('failed') ? '#dc2626' : '#16a34a',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={13} />
              {statusMessage}
            </div>
          )}

          {/* Discrete Developer Settings Toggle (Cleanly tucked away at bottom) */}
          <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setShowDevSettings(!showDevSettings)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Settings size={11} />
              {showDevSettings ? 'Hide Google Cloud Settings' : 'Custom Google Cloud Settings'}
            </button>
          </div>

          {/* Collapsible Advanced Settings (for production Google Cloud Client IDs) */}
          {showDevSettings && (
            <div
              className="animate-fade-in"
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Google Cloud OAuth Client ID:</span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '10px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    Google Cloud Console <ExternalLink size={9} />
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="xxxx.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSaveClientId}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Or Direct Google Token (Google OAuth Playground):
                </span>
                <form onSubmit={handleConnectToken} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="password"
                    placeholder="ya29..."
                    value={customTokenInput}
                    onChange={(e) => setCustomTokenInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    Connect
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            VIEW 2: GOOGLE DRIVE FILE BROWSER (When user IS signed in)
           ========================================================================= */
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '740px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drive Header Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Google Drive Logo & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 87.3 78">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h55.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Google Drive
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  My Drive
                </span>
              </div>
            </div>

            {/* Signed-in Account Pill with Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.email}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                }}
                title="Switch Account / Sign Out"
              >
                <LogOut size={13} />
                Sign Out
              </button>

              <button
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Drive Body */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search and Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search in Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Direct Local Upload */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".notein,.in,.pdf,.docx,.txt,.md,image/*"
                onChange={handleDirectUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Folder size={14} />
                Upload Local File
              </button>
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: statusMessage.includes('Failed') || statusMessage.includes('Error') ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                  color: statusMessage.includes('Failed') || statusMessage.includes('Error') ? '#dc2626' : '#16a34a',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={13} />
                {statusMessage}
              </div>
            )}

            {/* Files List Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Files ({filteredFiles.length})
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isLive ? 'rgba(22, 163, 74, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                    color: isLive ? '#16a34a' : 'var(--accent-primary)',
                  }}
                >
                  {isLive ? 'Live Drive' : 'Connected'}
                </span>
              </div>
            </div>

            {/* Drive Files Scrollable List */}
            <div
              style={{
                maxHeight: '320px',
                overflowY: 'auto',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {filteredFiles.length > 0 ? (
                filteredFiles.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      {getFileIcon(f.name)}
                      <div style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {f.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatFileSize(f.size)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(f.modifiedTime).toLocaleDateString()}
                          </span>
                          {f.description && (
                            <>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                {f.description}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bring to NoteIn CTA Button */}
                    <button
                      onClick={() => handleImportFile(f)}
                      disabled={importingFileId !== null}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: importingFileId === f.id ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                        color: importingFileId === f.id ? 'var(--text-muted)' : '#ffffff',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        flexShrink: 0,
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      {importingFileId === f.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Bringing...
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          Bring to NoteIn
                        </>
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No files found matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
