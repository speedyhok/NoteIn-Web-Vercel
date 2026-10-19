import React, { useState, useEffect } from 'react';
import type { GoogleUser, GoogleDriveFile, Notebook } from '../../types';
import { Modal } from '../common/Modal';
import {
  getGoogleUser,
  signInWithGoogle,
  signOutFromGoogle,
  listGoogleDriveFiles,
  fetchGoogleDriveFile,
  getSavedGoogleClientId,
  saveGoogleClientId,
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
  LogIn,
  Key,
  CheckCircle2,
  Loader2,
  Sparkles,
  Cloud,
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
  const [showConfig, setShowConfig] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');

  // Load user & Drive files on modal open
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
    } catch (err) {
      console.error('Failed to list Google Drive files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const u = await signInWithGoogle();
      setUser(u);
      setStatusMessage('Connected to Google Drive successfully!');
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromGoogle();
    setUser(null);
  };

  const handleSaveClientId = () => {
    saveGoogleClientId(clientIdInput);
    setShowConfig(false);
    setStatusMessage('Google Client ID saved.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

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

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

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
      title="Google Drive Cloud Sync"
      maxWidth="680px"
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
              gap: '6px',
            }}
          >
            <Key size={13} />
            {showConfig ? 'Hide Settings' : 'Google Cloud Settings'}
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
        {/* Google Authentication Account Card */}
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
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user.picture}
                alt={user.name}
                style={{
                  width: '42px',
                  height: '42px',
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
                      backgroundColor: 'rgba(22, 163, 74, 0.12)',
                      color: '#16a34a',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <CheckCircle2 size={11} /> Connected
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Cloud size={20} />
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>
                  Sign in with Google
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Connect your Google Drive to bring and sync NoteIn files
                </span>
              </div>
            </div>
          )}

          <div>
            {user ? (
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
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px var(--accent-glow)',
                  gap: '6px',
                }}
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* Optional Google Client ID Config Panel */}
        {showConfig && (
          <div
            className="animate-slide-down"
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Google Cloud OAuth Client ID (Optional for Production):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="your-client-id.apps.googleusercontent.com"
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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Leave empty to use instant connected Google Drive mode.
            </span>
          </div>
        )}

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className="animate-fade-in"
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: statusMessage.includes('Failed') ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)',
              color: statusMessage.includes('Failed') ? '#dc2626' : '#16a34a',
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
                Files in Google Drive
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({filteredFiles.length} items)
              </span>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search Drive files..."
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
              maxHeight: '280px',
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
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
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
