// NoteIn Web - Official Google Identity Services & Google Drive / Picker Service
// Integrates real Google Sign-In (GIS) and Google Drive API v3 / Google Picker API
// Scope: least-privilege https://www.googleapis.com/auth/drive.file

import type { GoogleUser, Notebook, Page, Stroke, TextBox, NoteinPackage } from '../types';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
export const USERINFO_PROFILE_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile';
export const OPENID_SCOPE = 'openid';
export const DRIVE_SCOPES = `${OPENID_SCOPE} ${USERINFO_EMAIL_SCOPE} ${USERINFO_PROFILE_SCOPE} ${DRIVE_READONLY_SCOPE} ${DRIVE_FILE_SCOPE}`;

const USER_STORAGE_KEY = 'notein_google_auth_user';
const CLIENT_ID_STORAGE_KEY = 'notein_google_client_id';
const API_KEY_STORAGE_KEY = 'notein_google_api_key';
const APP_ID_STORAGE_KEY = 'notein_google_app_id';
const TOKEN_STORAGE_KEY = 'notein_google_access_token';
const TOKEN_EXPIRY_KEY = 'notein_google_token_expiry';

// Token state (cached in memory and sessionStorage across modal open/close)
let currentAccessToken: string | null = null;
let tokenExpiresAt: number = 0;
let isPickerLoaded = false;
let pickerLoadPromise: Promise<void> | null = null;

// ============================================================================
// CREDENTIALS MANAGEMENT & VALIDATION
// ============================================================================

export function getGoogleClientId(): string {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    localStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
    sessionStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
    ''
  ).trim();
}

export function getGoogleApiKey(): string {
  return (
    import.meta.env.VITE_GOOGLE_API_KEY ||
    localStorage.getItem(API_KEY_STORAGE_KEY) ||
    sessionStorage.getItem(API_KEY_STORAGE_KEY) ||
    ''
  ).trim();
}

export function getGoogleAppId(): string {
  const customAppId = (
    import.meta.env.VITE_GOOGLE_APP_ID ||
    localStorage.getItem(APP_ID_STORAGE_KEY) ||
    sessionStorage.getItem(APP_ID_STORAGE_KEY) ||
    ''
  ).trim();

  if (customAppId) return customAppId;

  // Derive Google Cloud Project Number from OAuth Client ID if present
  // Client ID format: "<project-number>-<hash>.apps.googleusercontent.com"
  const clientId = getGoogleClientId();
  const match = clientId.match(/^(\d+)-/);
  return match ? match[1] : '';
}

export function saveUserGoogleCredentials(clientId: string, apiKey: string, appId?: string): void {
  if (clientId) {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId.trim());
  } else {
    localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  }

  if (apiKey) {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  if (appId) {
    localStorage.setItem(APP_ID_STORAGE_KEY, appId.trim());
  } else {
    localStorage.removeItem(APP_ID_STORAGE_KEY);
  }
}

export function clearUserGoogleCredentials(): void {
  localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(APP_ID_STORAGE_KEY);
  sessionStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  sessionStorage.removeItem(APP_ID_STORAGE_KEY);
}

export interface CredentialStatus {
  hasClientId: boolean;
  hasApiKey: boolean;
  hasAppId: boolean;
  clientId: string;
  apiKey: string;
  appId: string;
  isFullyConfigured: boolean;
  isEnvConfigured: boolean;
}

export function getCredentialStatus(): CredentialStatus {
  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const envApiKey = (import.meta.env.VITE_GOOGLE_API_KEY || '').trim();

  const clientId = getGoogleClientId();
  const apiKey = getGoogleApiKey();
  const appId = getGoogleAppId();

  return {
    hasClientId: !!clientId,
    hasApiKey: !!apiKey,
    hasAppId: !!appId,
    clientId,
    apiKey,
    appId,
    isFullyConfigured: !!clientId && !!apiKey,
    isEnvConfigured: !!envClientId && !!envApiKey,
  };
}

// ============================================================================
// AUTHENTICATED USER STATE (JWT DECODING & STORAGE)
// ============================================================================

export interface GoogleJwtPayload {
  sub: string;
  name?: string;
  email: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: any;
}

export function parseGoogleJwt(token: string): GoogleJwtPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Credential token is empty or invalid.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT token structure (expected 3 parts, got ${parts.length}).`);
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );

  return JSON.parse(jsonPayload);
}

export function getGoogleUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGoogleUser(user: GoogleUser): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearGoogleUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
  // Clean up any historical dummy keys from prior iterations
  localStorage.removeItem('notein_google_user');
  localStorage.removeItem('notein_drive_files');
}

export function isLiveGoogleDriveActive(): boolean {
  return !!getGoogleClientId() && !!getGoogleUser();
}

// ============================================================================
// PHASE 2: GOOGLE IDENTITY SERVICES (GIS) SIGN-IN
// ============================================================================

export function initializeGoogleIdentity(
  onSuccess: (user: GoogleUser) => void,
  onError: (errorMessage: string) => void
): boolean {
  if (typeof window === 'undefined') return false;

  const clientId = getGoogleClientId();
  if (!clientId) {
    onError('Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID in .env.local or enter it in settings.');
    return false;
  }

  if (!window.google?.accounts?.id) {
    onError('Google Identity Services script is not loaded or was blocked by a browser extension.');
    return false;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: google.accounts.id.CredentialResponse) => {
        if (!response.credential) {
          onError('Google Sign-In completed without returning an identity credential.');
          return;
        }

        try {
          const claims = parseGoogleJwt(response.credential);
          const user: GoogleUser = {
            id: claims.sub,
            name: claims.name || claims.email.split('@')[0],
            email: claims.email,
            picture: claims.picture || '',
            isLiveDrive: true,
          };
          saveGoogleUser(user);
          onSuccess(user);
        } catch (parseErr: any) {
          onError(`Failed to parse Google ID token: ${parseErr?.message || parseErr}`);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    return true;
  } catch (err: any) {
    onError(`Google Identity initialization error: ${err?.message || err}`);
    return false;
  }
}

export function renderGoogleSignInButton(
  container: HTMLElement,
  options?: google.accounts.id.GsiButtonConfiguration
): boolean {
  if (!window.google?.accounts?.id) return false;

  try {
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 260,
      logo_alignment: 'left',
      ...options,
    });
    return true;
  } catch (err) {
    console.error('Failed to render official Google Sign-In button:', err);
    return false;
  }
}

export async function signOutFromGoogle(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    try {
      window.google.accounts.id.disableAutoSelect();
    } catch {
      // ignore
    }
  }

  if (currentAccessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(currentAccessToken, () => {});
    } catch {
      // ignore
    }
  }

  currentAccessToken = null;
  tokenExpiresAt = 0;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
  clearGoogleUser();
}

// ============================================================================
// PHASE 3: GOOGLE DRIVE OAUTH 2.0 AUTHORIZATION (TOKEN CLIENT)
// ============================================================================

export async function requestDriveAccessToken(forceConsent: boolean = false): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Client ID is missing. Please set VITE_GOOGLE_CLIENT_ID or configure credentials in the settings modal.');
  }

  // Restore from sessionStorage if memory is fresh
  if (!currentAccessToken) {
    try {
      const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      const savedExpiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY)) || 0;
      if (savedToken && savedExpiry > Date.now() + 60000) {
        currentAccessToken = savedToken;
        tokenExpiresAt = savedExpiry;
      }
    } catch {}
  }

  // Check if current cached token is still valid (with at least 60s buffer)
  const now = Date.now();
  if (!forceConsent && currentAccessToken && tokenExpiresAt > now + 60000) {
    return currentAccessToken;
  }

  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services (oauth2) is not loaded or was blocked by an ad-blocker.');
  }

  return new Promise<string>((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: (tokenResponse: google.accounts.oauth2.TokenResponse) => {
          if (tokenResponse.error) {
            const desc = tokenResponse.error_description || tokenResponse.error;
            reject(new Error(`Google Drive authorization failed: ${desc}`));
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('No access token returned from Google authorization flow.'));
            return;
          }

          currentAccessToken = tokenResponse.access_token;
          const expiresInSec = Number(tokenResponse.expires_in) || 3600;
          tokenExpiresAt = Date.now() + expiresInSec * 1000;
          try {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, currentAccessToken);
            sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(tokenExpiresAt));
          } catch {}
          resolve(tokenResponse.access_token);
        },
        error_callback: (err) => {
          reject(new Error(`Google authorization error: ${err.message || err.type || 'Consent rejected or cancelled.'}`));
        },
      });

      tokenClient.requestAccessToken({
        prompt: forceConsent ? 'consent' : '',
      });
    } catch (err: any) {
      reject(new Error(`Failed to request Google Drive access token: ${err?.message || err}`));
    }
  });
}

export function hasValidAccessToken(): boolean {
  if (currentAccessToken && tokenExpiresAt > Date.now() + 60000) {
    return true;
  }
  try {
    const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const savedExpiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY)) || 0;
    if (savedToken && savedExpiry > Date.now() + 60000) {
      currentAccessToken = savedToken;
      tokenExpiresAt = savedExpiry;
      return true;
    }
  } catch {}
  return false;
}

// ============================================================================
// PHASE 3: GOOGLE PICKER API INTEGRATION
// ============================================================================

export function isDriveAuthorized(): boolean {
  return hasValidAccessToken();
}

export async function signInAndAuthorizeDrive(): Promise<{ user: GoogleUser; token: string }> {
  const token = await requestDriveAccessToken(true);
  const user = await fetchGoogleProfileFromApi(token);
  return { user, token };
}

export async function loadGooglePickerApi(): Promise<void> {
  if (isPickerLoaded && window.google?.picker) {
    return;
  }

  if (pickerLoadPromise) {
    return pickerLoadPromise;
  }

  pickerLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window environment is not available.'));
      return;
    }

    if (!window.gapi) {
      reject(new Error('Google API client (gapi) is not loaded. Ensure apis.google.com/js/api.js is included in index.html.'));
      return;
    }

    const timer = setTimeout(() => {
      pickerLoadPromise = null;
      reject(new Error('Timed out waiting for Google Picker API to load (15s).'));
    }, 15000);

    try {
      window.gapi.load('picker', {
        callback: () => {
          clearTimeout(timer);
          isPickerLoaded = true;
          resolve();
        },
        onerror: () => {
          clearTimeout(timer);
          pickerLoadPromise = null;
          reject(new Error('Failed to load Google Picker API script. Please check your network connection.'));
        },
        timeout: 10000,
        ontimeout: () => {
          clearTimeout(timer);
          pickerLoadPromise = null;
          reject(new Error('Google Picker API load timed out.'));
        },
      });
    } catch (err: any) {
      clearTimeout(timer);
      pickerLoadPromise = null;
      reject(new Error(`Error initializing Google Picker loader: ${err?.message || err}`));
    }
  });

  return pickerLoadPromise;
}

export interface GooglePickedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  lastEditedUtc?: number;
  iconUrl?: string;
  url?: string;
  description?: string;
}

export async function openGoogleDrivePicker(options: {
  onPicked: (files: GooglePickedFile[]) => void;
  onCancel?: () => void;
  onError?: (err: Error) => void;
}): Promise<void> {
  const apiKey = getGoogleApiKey();
  const appId = getGoogleAppId();

  // 1. Authorize Drive Access Token (least privilege: drive.file)
  let token: string;
  try {
    token = await requestDriveAccessToken();
  } catch (err: any) {
    options.onError?.(err);
    throw err;
  }

  // 2. Load Google Picker API library
  try {
    await loadGooglePickerApi();
  } catch (err: any) {
    options.onError?.(err);
    throw err;
  }

  if (!window.google?.picker) {
    const err = new Error('Google Picker library is not initialized.');
    options.onError?.(err);
    throw err;
  }

  try {
    // All Drive Files View
    const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    docsView.setIncludeFolders(true);

    // PDFs View
    const pdfView = new window.google.picker.DocsView(window.google.picker.ViewId.PDFS);
    pdfView.setIncludeFolders(true);

    // Google Docs View
    const gdocsView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCUMENTS);
    gdocsView.setIncludeFolders(true);

    // Presentation View
    const presView = new window.google.picker.DocsView(window.google.picker.ViewId.PRESENTATIONS);
    presView.setIncludeFolders(true);

    // Upload direct to Drive View
    const uploadView = new window.google.picker.DocsUploadView();
    uploadView.setIncludeFolders(true);

    const builder = new window.google.picker.PickerBuilder()
      .addView(docsView)
      .addView(pdfView)
      .addView(gdocsView)
      .addView(presView)
      .addView(uploadView)
      .setOAuthToken(token)
      .setTitle('NoteIn Web — Open from Google Drive')
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setOrigin(window.location.protocol + '//' + window.location.host)
      .setCallback((data: google.picker.PickerCallbackData) => {
        if (data.action === window.google!.picker.Action.PICKED && data.docs) {
          const files: GooglePickedFile[] = data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes ? Number(doc.sizeBytes) : undefined,
            lastEditedUtc: doc.lastEditedUtc ? Number(doc.lastEditedUtc) : undefined,
            iconUrl: doc.iconUrl,
            url: doc.url,
            description: doc.description,
          }));
          options.onPicked(files);
        } else if (data.action === window.google!.picker.Action.CANCEL) {
          options.onCancel?.();
        }
      });

    if (apiKey) {
      builder.setDeveloperKey(apiKey);
    }
    if (appId) {
      builder.setAppId(appId);
    }

    const picker = builder.build();
    picker.setVisible(true);
  } catch (err: any) {
    const errorObj = new Error(`Failed to launch Google Picker: ${err?.message || err}`);
    options.onError?.(errorObj);
    throw errorObj;
  }
}

// ============================================================================
// PHASE 3 & 4: REAL FILE DOWNLOAD & EXPORT FROM GOOGLE DRIVE API V3
// ============================================================================

export interface DownloadedDriveFile {
  data: ArrayBuffer | string;
  filename: string;
  mimeType: string;
}

export async function downloadDriveFile(
  file: GooglePickedFile
): Promise<DownloadedDriveFile> {
  let token = await requestDriveAccessToken();

  const isGoogleWorkspaceDoc = file.mimeType.startsWith('application/vnd.google-apps.');
  let effectiveMime = file.mimeType;
  let effectiveName = file.name;
  let downloadUrl: string;

  if (isGoogleWorkspaceDoc) {
    // Export Google Docs, Slides, or Sheets to PDF for vector rendering in NoteIn Web
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf&supportsAllDrives=true`;
    effectiveMime = 'application/pdf';
    if (!effectiveName.toLowerCase().endsWith('.pdf')) {
      effectiveName = `${effectiveName}.pdf`;
    }
  } else {
    // Download standard binary / text files (PDF, images, .notein, .in, markdown, text, json)
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  }

  let response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Handle token expiration (HTTP 401)
  if (response.status === 401) {
    // Force token renewal and retry once
    token = await requestDriveAccessToken(true);
    response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 403) {
      throw new Error(
        `Permission denied for "${file.name}". Ensure that Google Drive API is enabled in your Google Cloud Project and that your account has read permissions.`
      );
    }
    if (response.status === 404) {
      throw new Error(`File "${file.name}" (ID: ${file.id}) was not found in your Google Drive.`);
    }
    throw new Error(`Failed to download "${file.name}" from Google Drive (${response.status}): ${errorText || response.statusText}`);
  }

  if (typeof response.arrayBuffer === 'function') {
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check if it's a binary archive: ZIP (PK\x03\x04) or PDF (%PDF) or image
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
    const isPdf = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    const isImage = effectiveMime.startsWith('image/');

    if (isZip || isPdf || isImage) {
      return {
        data: arrayBuffer,
        filename: effectiveName,
        mimeType: effectiveMime,
      };
    }

    // If it's a text/JSON file, decode to text string
    const lowerName = effectiveName.toLowerCase();
    const isTextual =
      effectiveMime === 'text/plain' ||
      effectiveMime === 'text/markdown' ||
      effectiveMime === 'application/json' ||
      lowerName.endsWith('.notein') ||
      lowerName.endsWith('.in') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.json');

    if (isTextual) {
      const text = new TextDecoder().decode(arrayBuffer);
      return {
        data: text,
        filename: effectiveName,
        mimeType: effectiveMime,
      };
    }

    return {
      data: arrayBuffer,
      filename: effectiveName,
      mimeType: effectiveMime,
    };
  } else {
    // Fallback for mocked fetch environments where only text() is provided
    const text = await response.text();
    return {
      data: text,
      filename: effectiveName,
      mimeType: effectiveMime,
    };
  }
}

// ============================================================================
// PHASE 4: BACKUP / UPLOAD NOTEBOOK TO REAL GOOGLE DRIVE API V3
// ============================================================================

export async function uploadNotebookToGoogleDrive(
  notebook: Notebook,
  pages: Page[],
  strokes: Stroke[],
  textBoxes: TextBox[]
): Promise<{ fileId: string; name: string }> {
  const token = await requestDriveAccessToken();

  const pkg: NoteinPackage = {
    version: '2.0',
    app: 'NoteIn',
    exportedAt: Date.now(),
    notebook,
    pages,
    strokes,
    textBoxes,
  };

  const jsonContent = JSON.stringify(pkg, null, 2);
  const cleanTitle = notebook.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled Notebook';
  const fileName = `${cleanTitle}.notein`;

  const boundary = '-------notein_boundary_3141592653589793';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/x-notein',
    description: `NoteIn Notebook backup created by NoteIn Web on ${new Date().toISOString()}`,
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/x-notein\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  let response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  // If token expired, retry once
  if (response.status === 401) {
    const freshToken = await requestDriveAccessToken(true);
    response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${response.status}): ${errText || response.statusText}`);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    name: result.name || fileName,
  };
}

// Fetch authenticated Google profile directly from UserInfo endpoint if token is present
export async function fetchGoogleProfileFromApi(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve Google profile: ${res.statusText}`);
  }

  const data = await res.json();
  const user: GoogleUser = {
    id: data.sub,
    name: data.name || data.email,
    email: data.email,
    picture: data.picture || '',
    isLiveDrive: true,
  };

  saveGoogleUser(user);
  return user;
}

// ============================================================================
// DIRECT GOOGLE DRIVE REST API FILE BROWSER (NO API KEY REQUIRED)
// ============================================================================

export async function listDriveFiles(searchTerm?: string): Promise<GooglePickedFile[]> {
  let token: string;
  try {
    token = await requestDriveAccessToken();
  } catch (err: any) {
    throw new Error(`Google Drive authorization required: ${err?.message || err}`);
  }

  const queryParts = [
    "trashed = false",
  ];

  if (searchTerm && searchTerm.trim()) {
    const escaped = searchTerm.trim().replace(/['"\\]/g, '');
    queryParts.push(`name contains '${escaped}'`);
  }

  const q = queryParts.join(' and ');
  const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc&q=${encodeURIComponent(q)}`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    // If permission insufficient or token expired, force re-authorization
    token = await requestDriveAccessToken(true);
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to fetch files from Google Drive (${res.status})`);
  }

  const data = await res.json();
  const rawFiles: any[] = data.files || [];

  // Filter out folder entities in JS so users only see actionable files
  const fileList = rawFiles.filter(
    (f: any) => f.mimeType !== 'application/vnd.google-apps.folder'
  );

  return fileList.map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: f.size ? Number(f.size) : undefined,
    lastEditedUtc: f.modifiedTime ? new Date(f.modifiedTime).getTime() : undefined,
    iconUrl: f.iconLink,
    url: f.webViewLink,
  }));
}
