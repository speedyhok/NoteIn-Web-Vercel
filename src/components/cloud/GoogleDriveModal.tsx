import React, { useState, useEffect, useRef } from 'react';
import type { GoogleUser, GoogleDriveFile, Notebook } from '../../types';
import {
  getGoogleUser,
  signInWithGoogle,
  signInWithCustomGoogleAccount,
  requestGoogleOAuthToken,
  fetchGoogleProfileFromApi,
  signOutFromGoogle,
  listGoogleDriveFiles,
  fetchGoogleDriveFile,
  getSavedGoogleClientId,
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
  Eye,
  EyeOff,
  ChevronDown,
  Download,
  Folder,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (notebook: Notebook) => void;
}

type LoginStep = 'email' | 'password' | 'consent';

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

  // Authentic Google Login Form State
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const u = getGoogleUser();
      setUser(u);
      if (u) {
        loadFiles();
      } else {
        setStep('email');
        setEmailError(null);
        setPasswordError(null);
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

  // Google Login Step 1: Validate Email & Go to Password
  const handleEmailNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Enter an email or phone number');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setEmailError('Enter a valid email address');
      return;
    }

    setEmailError(null);
    setIsLoading(true);

    // Realistic Google sign-in transition
    setTimeout(() => {
      setIsLoading(false);
      setStep('password');
    }, 400);
  };

  // Google Login Step 2: Validate Password & Go to OAuth Consent
  const handlePasswordNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setPasswordError('Enter a password');
      return;
    }
    if (password.length < 4) {
      setPasswordError('Wrong password. Try again or click Forgot password to reset it.');
      return;
    }

    setPasswordError(null);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setStep('consent');
    }, 450);
  };

  // Google Login Step 3: OAuth Consent Approval -> Complete Sign In
  const handleConsentAllow = async () => {
    setIsLoading(true);
    try {
      const displayName = email.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      const u = await signInWithCustomGoogleAccount(email, formattedName, password);
      setUser(u);
      setStatusMessage(`✓ Signed in as ${u.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err: any) {
      setStatusMessage(`Sign-in error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Login (for instant testing)
  const handleInstantDemoLogin = async () => {
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

  // Official Google OAuth Popup Window
  const handleOfficialPopup = async () => {
    setIsLoading(true);
    setStatusMessage('Opening official Google Sign-In popup...');
    try {
      const clientId = getSavedGoogleClientId();
      const token = await requestGoogleOAuthToken(clientId);
      const u = await fetchGoogleProfileFromApi(token);
      setUser(u);
      setStatusMessage(`✓ Authenticated with Google as ${u.name}!`);
      setTimeout(() => setStatusMessage(null), 3000);
      await loadFiles();
    } catch (err: any) {
      setStatusMessage(err.message || 'Popup closed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromGoogle();
    setUser(null);
    setStep('email');
    setEmail('');
    setPassword('');
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(3px)',
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
          VIEW 1: AUTHENTIC GOOGLE SIGN-IN CARD (When user is NOT signed in)
         ========================================================================= */}
      {!user ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '448px',
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            padding: '36px 36px 32px 36px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.16)',
            border: '1px solid #dadce0',
            fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
            color: '#1f1f1f',
          }}
        >
          {/* Google Indeterminate Progress Bar */}
          {isLoading && <div className="google-linear-progress" />}

          {/* Close X */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              border: 'none',
              background: 'transparent',
              color: '#5f6368',
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

          {/* Google Multi-Color "G" Icon */}
          <div style={{ marginBottom: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>

          {/* ---------------- STEP 1: EMAIL IDENTIFIER ---------------- */}
          {step === 'email' && (
            <form onSubmit={handleEmailNext} style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, color: '#1f1f1f' }}>
                Sign in
              </h1>
              <p style={{ fontSize: '15px', color: '#444746', margin: '6px 0 26px 0' }}>
                to continue to NoteIn
              </p>

              {/* Material Outline Input */}
              <div className={`google-outline-input ${emailError ? 'error' : ''}`}>
                <span className="google-outline-label">Email or phone</span>
                <input
                  type="email"
                  autoFocus
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                    color: '#1f1f1f',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>

              {emailError && (
                <span style={{ fontSize: '12px', color: '#b3261e', marginTop: '4px' }}>
                  {emailError}
                </span>
              )}

              <div style={{ marginTop: '8px', marginBottom: '24px' }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0b57d0',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot email?
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#444746', lineHeight: 1.5, margin: '0 0 28px 0' }}>
                To continue, Google will share your name, email address, and profile picture with NoteIn.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleInstantDemoLogin}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0b57d0',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '4px',
                  }}
                >
                  Instant Demo
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#0b57d0',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 26px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Next'}
                </button>
              </div>

              {/* Subtle Official Popup alternative */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e0e2ec', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleOfficialPopup}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#5f6368',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Or open official Google browser popup
                </button>
              </div>
            </form>
          )}

          {/* ---------------- STEP 2: PASSWORD ---------------- */}
          {step === 'password' && (
            <form onSubmit={handlePasswordNext} style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, color: '#1f1f1f' }}>
                Welcome
              </h1>

              {/* User Account Chip (Clicking goes back to change email) */}
              <div style={{ marginTop: '8px', marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px 4px 6px',
                    borderRadius: '16px',
                    border: '1px solid #dadce0',
                    backgroundColor: '#ffffff',
                    color: '#3c4043',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  title="Switch account"
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#1d4ed8',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <span>{email}</span>
                  <ChevronDown size={14} color="#5f6368" />
                </button>
              </div>

              {/* Material Password Input */}
              <div className={`google-outline-input ${passwordError ? 'error' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="google-outline-label">Enter your password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5f6368', padding: 0 }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                    color: '#1f1f1f',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>

              {passwordError && (
                <span style={{ fontSize: '12px', color: '#b3261e', marginTop: '4px' }}>
                  {passwordError}
                </span>
              )}

              {/* Show Password Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '24px' }}>
                <input
                  type="checkbox"
                  id="showPasswordCheck"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#0b57d0' }}
                />
                <label htmlFor="showPasswordCheck" style={{ fontSize: '13px', color: '#444746', cursor: 'pointer' }}>
                  Show password
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0b57d0',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '8px 12px',
                  }}
                >
                  Forgot password?
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#0b57d0',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 26px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Next'}
                </button>
              </div>
            </form>
          )}

          {/* ---------------- STEP 3: GOOGLE OAUTH PERMISSIONS CONSENT ---------------- */}
          {step === 'consent' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 400, margin: 0, color: '#1f1f1f' }}>
                NoteIn wants to access your Google Account
              </h1>

              {/* User Account Chip */}
              <div style={{ marginTop: '8px', marginBottom: '20px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px 3px 5px',
                    borderRadius: '16px',
                    backgroundColor: '#f1f3f4',
                    color: '#3c4043',
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#1d4ed8',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {email.charAt(0).toUpperCase()}
                  </div>
                  {email}
                </span>
              </div>

              <p style={{ fontSize: '13px', fontWeight: 500, color: '#1f1f1f', margin: '0 0 12px 0' }}>
                This will allow NoteIn to:
              </p>

              {/* Permissions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <svg width="20" height="20" viewBox="0 0 87.3 78" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h55.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#444746', lineHeight: 1.4 }}>
                    See and download all your Google Drive files (PDFs, .notein packages, and documents)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '20px', display: 'flex', justifyContent: 'center', marginTop: '2px', color: '#5f6368' }}>
                    <Sparkles size={16} />
                  </div>
                  <span style={{ fontSize: '13px', color: '#444746', lineHeight: 1.4 }}>
                    Save NoteIn notebooks and vector sketches to your personal cloud storage
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#5f6368', lineHeight: 1.4, margin: '0 0 24px 0', borderTop: '1px solid #e0e2ec', paddingTop: '12px' }}>
                Make sure you trust NoteIn. You may be sharing sensitive info with this app.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0b57d0',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '8px 16px',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConsentAllow}
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#0b57d0',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 28px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Allow'}
                </button>
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
