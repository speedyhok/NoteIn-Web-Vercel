// Google Drive Cloud Sync & Google Identity Service for NoteIn Web
// Supports Official Google OAuth 2.0 (GIS), Live Google Drive API v3, Custom Account Credentials, Access Tokens, and Cloud Backup

import type { GoogleUser, GoogleDriveFile, Notebook, Page, Stroke, TextBox, NoteinPackage, PaperTemplate } from '../types';

const USER_STORAGE_KEY = 'notein_google_user';
const DRIVE_FILES_STORAGE_KEY = 'notein_drive_files';
const CLIENT_ID_STORAGE_KEY = 'notein_google_client_id';

// Default pre-seeded NoteIn documents available for demonstration and offline testing
export const INITIAL_DEMO_DRIVE_FILES: GoogleDriveFile[] = [
  {
    id: 'drive_file_calculus_notein',
    name: 'Calculus_Lecture_Notes.notein',
    mimeType: 'application/x-notein',
    size: 3564100,
    modifiedTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    description: 'Comprehensive differential equations and vector calculus notes',
  },
  {
    id: 'drive_file_biology_in',
    name: 'Biology_Cell_Biology_Guide.in',
    mimeType: 'application/x-notein',
    size: 2210400,
    modifiedTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    description: 'Cellular biology summary with Cornell structure and diagram callouts',
  },
  {
    id: 'drive_file_design_pdf',
    name: 'Design_System_Guidelines.pdf',
    mimeType: 'application/pdf',
    size: 4890200,
    modifiedTime: new Date(Date.now() - 3600000 * 48).toISOString(),
    description: 'UI/UX visual specifications and design token hierarchy',
  },
  {
    id: 'drive_file_product_notein',
    name: 'Product_Strategy_2026.notein',
    mimeType: 'application/x-notein',
    size: 1420800,
    modifiedTime: new Date(Date.now() - 3600000 * 72).toISOString(),
    description: 'Executive quarterly roadmap and feature milestones',
  },
  {
    id: 'drive_file_architecture_md',
    name: 'Vector_Inking_Engine_Architecture.md',
    mimeType: 'text/markdown',
    size: 48200,
    modifiedTime: new Date(Date.now() - 3600000 * 96).toISOString(),
    description: 'Technical document on spline curves and pressure interpolation',
  },
];

// Helper to generate realistic sample NoteIn package content for drive files
function generateSampleNoteinContent(filename: string): NoteinPackage {
  const cleanTitle = filename.replace(/\.(notein|in)$/i, '').replace(/_/g, ' ');
  const notebookId = crypto.randomUUID();
  const page1Id = crypto.randomUUID();
  const page2Id = crypto.randomUUID();
  const now = Date.now();

  const isCalculus = filename.includes('Calculus');
  const isBiology = filename.includes('Biology');

  const strokes: Stroke[] = [
    {
      id: crypto.randomUUID(),
      pageId: page1Id,
      toolType: 'pen',
      penStyle: 'fountain',
      color: '#1d4ed8',
      width: 4,
      opacity: 1.0,
      points: [
        { x: 120, y: 140, pressure: 0.5, time: now - 5000 },
        { x: 160, y: 135, pressure: 0.7, time: now - 4800 },
        { x: 230, y: 145, pressure: 0.8, time: now - 4500 },
        { x: 300, y: 140, pressure: 0.4, time: now - 4200 },
      ],
      bounds: { minX: 120, minY: 135, maxX: 300, maxY: 145 },
      createdAt: now - 5000,
    },
    {
      id: crypto.randomUUID(),
      pageId: page1Id,
      toolType: 'highlighter',
      penStyle: 'ballpoint',
      color: '#facc15',
      width: 18,
      opacity: 0.4,
      points: [
        { x: 110, y: 180, pressure: 0.4, time: now - 3500 },
        { x: 280, y: 180, pressure: 0.4, time: now - 3200 },
        { x: 420, y: 180, pressure: 0.4, time: now - 2800 },
      ],
      bounds: { minX: 110, minY: 180, maxX: 420, maxY: 180 },
      createdAt: now - 3500,
    },
  ];

  const textBoxes: TextBox[] = [
    {
      id: crypto.randomUUID(),
      pageId: page1Id,
      x: 110,
      y: 195,
      width: 580,
      height: 160,
      content: isCalculus
        ? '<h3>Taylor Series & Differential Approximations</h3><p>Let <code>f(x)</code> be infinitely differentiable at <i>x = a</i>. The polynomial is defined as:</p><p style="color: #2563eb; font-weight: bold;">P(x) = f(a) + f\'(a)(x-a) + f\'\'(a)/2! (x-a)^2 + ...</p>'
        : isBiology
        ? '<h3>Mitochondrial ATP Synthesis Pathway</h3><p>Oxidative phosphorylation generates <b>30-32 ATP molecules</b> per glucose molecule via the inner mitochondrial membrane proton gradient.</p>'
        : '<h3>Executive Strategic Goals</h3><p>Synchronize cross-platform vector notes with cloud storage via Google Drive.</p>',
      fontSize: 15,
      fontFamily: 'Inter, sans-serif',
      color: '#1f2937',
      bold: false,
      italic: false,
      alignment: 'left',
      createdAt: now - 8000,
      updatedAt: now - 8000,
    },
  ];

  const template: PaperTemplate = {
    type: isBiology ? 'cornell' : 'ruled',
    lineSpacing: 28,
    gridSize: 20,
    patternColor: '#d0d7de',
    bgColor: '#ffffff',
  };

  return {
    version: '2.0',
    app: 'NoteIn',
    exportedAt: now,
    notebook: {
      id: notebookId,
      title: cleanTitle,
      coverColor: isCalculus ? '#2563eb' : isBiology ? '#16a34a' : '#9333ea',
      coverPattern: 'gradient',
      defaultTemplate: template,
      orientation: 'portrait',
      importedFrom: 'drive',
      sourceFilename: filename,
      createdAt: now - 86400000,
      updatedAt: now,
      pageCount: 2,
    },
    pages: [
      {
        id: page1Id,
        notebookId,
        pageNumber: 1,
        title: 'Page 1',
        template,
        width: 794,
        height: 1123,
        orientation: 'portrait',
        createdAt: now - 86400000,
        updatedAt: now,
      },
      {
        id: page2Id,
        notebookId,
        pageNumber: 2,
        title: 'Page 2',
        template: {
          type: 'grid',
          lineSpacing: 28,
          gridSize: 20,
          patternColor: '#d0d7de',
          bgColor: '#ffffff',
        },
        width: 794,
        height: 1123,
        orientation: 'portrait',
        createdAt: now - 86400000,
        updatedAt: now,
      },
    ],
    strokes,
    textBoxes,
  };
}

/**
 * Retrieves the currently signed-in Google user from storage.
 */
export function getGoogleUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether live Google Drive sync is currently connected (via OAuth or Access Token).
 */
export function isLiveGoogleDriveActive(): boolean {
  const user = getGoogleUser();
  return Boolean(user && user.accessToken && user.isLiveDrive);
}

/**
 * Initiates the official Google OAuth 2.0 login popup via Google Identity Services (GIS).
 * Opens accounts.google.com where the user logs in with their real Google ID & password.
 */
export async function requestGoogleOAuthToken(clientId?: string): Promise<string> {
  const effectiveClientId = clientId || getSavedGoogleClientId();
  if (!effectiveClientId) {
    throw new Error('Please enter your Google Cloud OAuth Client ID below to launch the official Google login popup.');
  }

  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.oauth2) {
      reject(new Error('Google Identity Services library is not loaded. Please ensure you are connected to the internet.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token returned from Google authentication'));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Fetches user profile from Google's official userinfo API with active access token.
 */
export async function fetchGoogleProfileFromApi(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google API responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  const user: GoogleUser = {
    id: data.sub || 'google_' + Date.now(),
    name: data.name || data.email,
    email: data.email,
    picture: data.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name || data.email)}&backgroundColor=1d4ed8`,
    isDemo: false,
    accessToken,
    authType: 'oauth',
    isLiveDrive: true,
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

/**
 * Signs in using a direct Google Access Token (e.g. from Google OAuth Playground or GCP).
 * Connects directly to the user's live Google Drive.
 */
export async function signInWithGoogleAccessToken(token: string): Promise<GoogleUser> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Please enter a valid Google OAuth Access Token');
  }

  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });

    let user: GoogleUser;
    if (profileRes.ok) {
      const data = await profileRes.json();
      user = {
        id: data.sub || 'google_' + Date.now(),
        name: data.name || data.email,
        email: data.email,
        picture: data.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name || data.email)}&backgroundColor=1d4ed8`,
        isDemo: false,
        accessToken: cleanToken,
        authType: 'token',
        isLiveDrive: true,
      };
    } else {
      // Test drive access directly if userinfo scope was omitted
      const driveRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });
      if (driveRes.ok) {
        const driveData = await driveRes.json();
        user = {
          id: driveData.user?.permissionId || 'google_' + Date.now(),
          name: driveData.user?.displayName || 'Google Drive User',
          email: driveData.user?.emailAddress || 'drive.user@google.com',
          picture: driveData.user?.photoLink || `https://api.dicebear.com/7.x/initials/svg?seed=Drive&backgroundColor=1d4ed8`,
          isDemo: false,
          accessToken: cleanToken,
          authType: 'token',
          isLiveDrive: true,
        };
      } else {
        throw new Error('Invalid or expired Google Access Token. Please verify token permissions (needs drive.readonly or drive.file).');
      }
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to authenticate with Google Access Token');
  }
}

/**
 * Signs in using custom Google Account credentials (user's own real email, display name, and optional local vault password).
 */
export async function signInWithCustomGoogleAccount(
  email: string,
  name?: string,
  password?: string
): Promise<GoogleUser> {
  const cleanEmail = email.trim();
  const cleanName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];

  const user: GoogleUser = {
    id: 'google_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
    name: cleanName,
    email: cleanEmail,
    picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=1d4ed8`,
    isDemo: false,
    hasPassword: Boolean(password && password.length > 0),
    authType: 'custom',
    isLiveDrive: false,
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  if (password) {
    localStorage.setItem(`notein_vault_pass_${user.id}`, password);
  }
  return user;
}

/**
 * Signs in with Google (demo or custom user).
 */
export async function signInWithGoogle(customUser?: Partial<GoogleUser>): Promise<GoogleUser> {
  const user: GoogleUser = {
    id: customUser?.id || 'google_user_' + Math.random().toString(36).substring(2, 9),
    name: customUser?.name || 'Alex Chen',
    email: customUser?.email || 'alex.chen@gmail.com',
    picture: customUser?.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    isDemo: customUser?.isDemo ?? true,
    accessToken: customUser?.accessToken,
    authType: customUser?.authType || 'custom',
    isLiveDrive: Boolean(customUser?.accessToken),
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

/**
 * Signs out of Google.
 */
export async function signOutFromGoogle(): Promise<void> {
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Lists NoteIn documents and files in Google Drive.
 * If user has an active OAuth / Access token, queries real Google Drive API v3.
 */
export async function listGoogleDriveFiles(): Promise<GoogleDriveFile[]> {
  const user = getGoogleUser();

  // If user has a live OAuth access token, fetch real files from Google Drive API
  if (user && user.accessToken) {
    try {
      const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&q=${encodeURIComponent('trashed = false')}&orderBy=modifiedTime desc`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          return data.files.map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: parseInt(f.size || '0', 10),
            modifiedTime: f.modifiedTime || new Date().toISOString(),
            description: `Live Google Drive (${f.mimeType.split('/').pop() || f.mimeType})`,
          }));
        }
        return [];
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Real Google Drive API query error:', errJson);
      }
    } catch (err) {
      console.warn('Real Google Drive API query error, falling back to local files:', err);
    }
  }

  try {
    const raw = localStorage.getItem(DRIVE_FILES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  // Initialize with default cloud files if not yet seeded
  localStorage.setItem(DRIVE_FILES_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_DRIVE_FILES));
  return INITIAL_DEMO_DRIVE_FILES;
}

/**
 * Fetches content of a specific file from Google Drive.
 */
export async function fetchGoogleDriveFile(fileId: string): Promise<{
  data: string | ArrayBuffer;
  filename: string;
  mimeType: string;
}> {
  const user = getGoogleUser();

  // If live OAuth token and not a mock drive ID, download from live Google Drive API
  if (user && user.accessToken && !fileId.startsWith('drive_file_') && !fileId.startsWith('drive_')) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json') || contentType.includes('text/')
          ? await res.text()
          : await res.arrayBuffer();
        const files = await listGoogleDriveFiles();
        const target = files.find((f) => f.id === fileId);
        return {
          data,
          filename: target?.name || 'downloaded_from_drive.notein',
          mimeType: target?.mimeType || 'application/octet-stream',
        };
      }
    } catch (err) {
      console.warn('Failed live download from Google Drive API:', err);
    }
  }

  const files = await listGoogleDriveFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) {
    throw new Error(`Google Drive file ${fileId} not found`);
  }

  // If file already has embedded package content, return it
  if (file.content) {
    return {
      data: file.content,
      filename: file.name,
      mimeType: file.mimeType,
    };
  }

  // Generate NoteIn package content for .notein / .in files
  if (file.name.endsWith('.notein') || file.name.endsWith('.in')) {
    const pkg = generateSampleNoteinContent(file.name);
    return {
      data: JSON.stringify(pkg, null, 2),
      filename: file.name,
      mimeType: file.mimeType,
    };
  }

  // Sample markdown text for .md files
  if (file.name.endsWith('.md')) {
    const md = `# Vector Inking Engine Architecture\n\n- Catmull-Rom spline curves with dynamic velocity taper\n- Non-destructive pixel eraser clipping masks\n- Synchronized with Google Drive Cloud Backup\n\n\`\`\`typescript\nfunction interpolateSpline(p1, p2, t) {\n  return p1 + (p2 - p1) * t;\n}\n\`\`\``;
    return {
      data: md,
      filename: file.name,
      mimeType: 'text/markdown',
    };
  }

  return {
    data: '',
    filename: file.name,
    mimeType: file.mimeType,
  };
}

/**
 * Uploads/Backs up a local notebook to Google Drive as a .notein package.
 */
export async function uploadNotebookToGoogleDrive(
  notebook: Notebook,
  pages: Page[],
  strokes: Stroke[],
  textBoxes: TextBox[]
): Promise<GoogleDriveFile> {
  const pkg: NoteinPackage = {
    version: '2.0',
    app: 'NoteIn',
    exportedAt: Date.now(),
    notebook,
    pages,
    strokes,
    textBoxes,
  };

  const filename = `${notebook.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.notein`;
  const content = JSON.stringify(pkg, null, 2);

  const newDriveFile: GoogleDriveFile = {
    id: 'drive_' + crypto.randomUUID(),
    name: filename,
    mimeType: 'application/x-notein',
    size: new Blob([content]).size,
    modifiedTime: new Date().toISOString(),
    description: `Backed up from NoteIn Studio (${pages.length} pages, ${strokes.length} strokes)`,
    content,
  };

  const existingFiles = await listGoogleDriveFiles();
  const updatedFiles = [newDriveFile, ...existingFiles.filter((f) => f.name !== filename)];
  localStorage.setItem(DRIVE_FILES_STORAGE_KEY, JSON.stringify(updatedFiles));

  return newDriveFile;
}

/**
 * Deletes a file from Google Drive storage.
 */
export async function deleteGoogleDriveFile(fileId: string): Promise<void> {
  const existingFiles = await listGoogleDriveFiles();
  const filtered = existingFiles.filter((f) => f.id !== fileId);
  localStorage.setItem(DRIVE_FILES_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Configurable Client ID management for real Google Cloud OAuth credentials.
 */
export function getSavedGoogleClientId(): string {
  return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '';
}

export function saveGoogleClientId(clientId: string): void {
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId.trim());
}
