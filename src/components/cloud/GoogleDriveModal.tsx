import React, { useState, useEffect, useRef } from 'react';
import type { GoogleUser, GoogleDriveFile, Notebook } from '../../types';
import { Modal } from '../common/Modal';
import {
  getGoogleUser,
  signInWithGoogle,
  signInWithCustomGoogleAccount,
  signInWithGoogleAccessToken,
  requestGoogleOAuthToken,
  fetchGoogleProfileFromApi,
  signOutFromGoogle,
  listGoogleDriveFiles,
  fetchGoogleDriveFile,
  getSavedGoogleClientId,
  saveGoogleClientId,
  isLiveGoogleDriveActive,
} from '../../services/googleDriveService';
import { importAnyDocument } from '../../services/documentImporter';
import {
  HardDrive,
  Download,
  Search,
  FileText,
  FileCode,
  FileImage,
  LogOut,
  Key,
  CheckCircle2,
  Loader2,
  Sparkles,
  Shield,
  ExternalLink,
  Lock,
  Folder,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (notebook: Notebook) => void;
}

type AuthTab = 'custom' | 'oauth' | 'token' | 'upload';

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
  const [activeTab, setActiveTab] = useState<AuthTab>('custom');

  // Custom Google ID State
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [customName, setCustomName] = useState('');

  // OAuth State
  const [clientIdInput, setClientIdInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Access Token State
  const [accessTokenInput, setAccessTokenInput] = useState('');

  // Local file upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const u = getGoogleUser();
      setUser(u);
      setClientIdInput(getSavedGoogleClientId());
      loadFiles();
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

  // 1. Sign in with Custom Google ID & Password
  const handleCustomSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setStatusMessage('Please enter a valid Google email address (e.g. name@gmail.com)');
      return;
    }

    setIsLoading(true);
    try {
      const u = await signInWithCustomGoogleAccount(customEmail, customName, customPassword);
      setUser(u);
      setStatusMessage(`✓ Signed in with Google Account: ${u.email}`);
      setTimeout(() => setStatusMessage(null), 3500);
      await loadFiles();
    } catch (err: any) {
      setStatusMessage(`Login error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Official Google OAuth 2.0 Popup (accounts.google.com)
  const handleOfficialOAuthSignIn = async () => {
    setIsLoading(true);
    setStatusMessage('Opening official Google Sign-In popup...');
    try {
      const token = await requestGoogleOAuthToken(clientIdInput);
      const u = await fetchGoogleProfileFromApi(token);
      setUser(u);
      setStatusMessage(`✓ Authenticated with Google as ${u.name}! Live Drive connected.`);
      setTimeout(() => setStatusMessage(null), 3500);
      await loadFiles();
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setStatusMessage(`OAuth Error: ${err.message || 'Google popup closed or client ID missing'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Connect via Direct Google Access Token (Live Drive)
  const handleTokenSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!accessTokenInput.trim()) {
      setStatusMessage('Please enter an Access Token');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Connecting to Google Drive API...');
    try {
      const u = await signInWithGoogleAccessToken(accessTokenInput);
      setUser(u);
      setStatusMessage(`✓ Connected to live Google Drive as ${u.name}!`);
      setTimeout(() => setStatusMessage(null), 3500);
      await loadFiles();
    } catch (err: any) {
      setStatusMessage(`Token Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Connect Demo
  const handleInstantConnect = async () => {
    setIsLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);
      setStatusMessage('Connected to Google Drive workspace!');
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromGoogle();
    setUser(null);
    setStatusMessage('Signed out of Google.');
    setTimeout(() => setStatusMessage(null), 2500);
    await loadFiles();
  };

  const handleSaveClientId = () => {
    saveGoogleClientId(clientIdInput);
    setStatusMessage('Google Client ID saved.');
    setTimeout(() => setStatusMessage(null), 3000);
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

  // Direct Local File Upload (from local Google Drive sync folder or PC)
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Drive Cloud Sync & Sign-In"
      maxWidth="740px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Key size={13} />
            {showConfig ? 'Hide Cloud Config' : 'Google Cloud Settings'}
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Security & Password Policy Explanation Card */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          <Shield size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Google Authentication Security:</strong> Google strictly prohibits third-party websites from collecting raw Google passwords directly in web forms. To access your Google account, you can use the official Google OAuth popup (where you enter your password directly on <code>accounts.google.com</code>), or sign in with your Google ID below to lock/protect your personal notebooks.
          </div>
        </div>

        {/* User Account Status Card (When Signed In) */}
        {user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user.picture}
                alt={user.name}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  objectFit: 'cover',
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {user.name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      backgroundColor: isLive ? 'rgba(22, 163, 74, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: isLive ? '#16a34a' : 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <CheckCircle2 size={11} /> {isLive ? 'Live Drive Connected' : 'Google ID Connected'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {user.email}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {!isLive && (
                <button
                  type="button"
                  onClick={handleOfficialOAuthSignIn}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--accent-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Key size={13} />
                  Connect Live Drive
                </button>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Sign-In Options Tabs (When Not Signed In) */
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Tabs for Signing In */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: activeTab === 'custom' ? 'var(--accent-light)' : 'transparent',
                  color: activeTab === 'custom' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                My Google ID & Password
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('oauth')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: activeTab === 'oauth' ? 'var(--accent-light)' : 'transparent',
                  color: activeTab === 'oauth' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Official Google Popup (OAuth)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('token')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: activeTab === 'token' ? 'var(--accent-light)' : 'transparent',
                  color: activeTab === 'token' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Direct Access Token
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: activeTab === 'upload' ? 'var(--accent-light)' : 'transparent',
                  color: activeTab === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Import from Drive / PC
              </button>
            </div>

            {/* TAB 1: User's own Google ID & Password Form */}
            {activeTab === 'custom' && (
              <form onSubmit={handleCustomSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Your Google Email ID:
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="yourname@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Notebook Vault Password / PIN:
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Name (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-strong)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Locks your local notebooks to your personal Google identity.
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleInstantConnect}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Instant Demo
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                      Connect Account
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: Official Google Identity Services Popup */}
            {activeTab === 'oauth' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Opens Google's official OAuth authorization window (at <code>accounts.google.com</code>). You enter your Google email and password directly on Google's secure server, granting NoteIn permission to read your Google Drive files.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleOfficialOAuthSignIn}
                    disabled={isLoading}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#ffffff',
                      color: '#3c4043',
                      border: '1px solid #dadce0',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      boxShadow: '0 1px 2px rgba(60,64,67,0.15)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Sign in with Google
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Requires Google Cloud Client ID (free setup).
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: Direct Access Token */}
            {activeTab === 'token' && (
              <form onSubmit={handleTokenSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Paste a temporary Google Drive Access Token (from <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Google OAuth Playground</a> with <code>drive.readonly</code> scope) to instantly browse your real Drive files.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="Paste Access Token (ya29...)"
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Connect Live Drive
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: Direct Local File Import from Google Drive Desktop Folder */}
            {activeTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  If you have files saved from Google Drive on your device (e.g. <code>.notein</code>, <code>.pdf</code>, <code>.docx</code>, images), pick them directly to bring them into NoteIn Studio:
                </p>
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
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px dashed var(--accent-primary)',
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Folder size={16} />
                  Select File from Computer or Google Drive Folder
                </button>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Google Cloud Config */}
        {showConfig && (
          <div
            className="animate-fade-in"
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Google Cloud OAuth Client ID:
              </span>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Google Cloud Console <ExternalLink size={10} />
              </a>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="xxxx.apps.googleusercontent.com"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSaveClientId}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

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

        {/* Drive Files Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={15} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isLive ? 'Files in My Google Drive (Live)' : 'Files in Cloud Storage'}
              </h3>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isLive ? 'rgba(22, 163, 74, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: isLive ? '#16a34a' : '#ca8a04',
                }}
              >
                {isLive ? 'Live Sync' : 'Demo Cloud Drive'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({filteredFiles.length} items)
              </span>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Cloud Files List */}
          <div
            style={{
              maxHeight: '260px',
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
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No files found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
