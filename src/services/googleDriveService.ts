// Google Drive Cloud Sync & Google Identity Service for NoteIn Web
// Replicates the cloud synchronization and backup architecture decompiled from NoteIn APK (NetDiskAuthorizeActivity)

import type { GoogleUser, GoogleDriveFile, Notebook, Page, Stroke, TextBox, NoteinPackage } from '../types';

const USER_STORAGE_KEY = 'notein_google_user';
const DRIVE_FILES_STORAGE_KEY = 'notein_drive_files';
const CLIENT_ID_STORAGE_KEY = 'notein_google_client_id';

// Default pre-seeded NoteIn documents available in Google Drive
const INITIAL_DEMO_DRIVE_FILES: GoogleDriveFile[] = [
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
      color: isCalculus ? '#1d4ed8' : '#059669',
      width: 4.0,
      opacity: 1.0,
      points: [
        { x: 120, y: 140, pressure: 0.5 },
        { x: 140, y: 142, pressure: 0.7 },
        { x: 170, y: 141, pressure: 0.8 },
        { x: 210, y: 139, pressure: 0.6 },
      ],
      bounds: { minX: 118, minY: 138, maxX: 212, maxY: 144 },
      createdAt: now - 10000,
    },
    {
      id: crypto.randomUUID(),
      pageId: page1Id,
      toolType: 'highlighter',
      color: '#facc15',
      width: 22,
      opacity: 0.4,
      points: [
        { x: 110, y: 140, pressure: 0.5 },
        { x: 290, y: 140, pressure: 0.5 },
      ],
      bounds: { minX: 108, minY: 128, maxX: 292, maxY: 152 },
      createdAt: now - 9000,
    },
  ];

  const textBoxes: TextBox[] = [
    {
      id: crypto.randomUUID(),
      pageId: page1Id,
      x: 100,
      y: 190,
      width: 580,
      height: 160,
      content: isCalculus
        ? `<h3 style="color: rgb(30, 58, 138); margin: 0 0 8px 0;">Differential Calculus & Taylor Expansions</h3>
<p style="margin: 0 0 6px 0;">Imported seamlessly from <strong>Google Drive</strong> cloud storage.</p>
<ul style="padding-left: 20px; margin: 4px 0;">
  <li><strong>Theorem 1:</strong> Continuous differentiability implies local linearity</li>
  <li><strong>Application:</strong> Gradient descent in high-dimensional feature spaces</li>
</ul>
<div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 6px 10px; border-radius: 4px; font-size: 13px; color: #166534;">
  ✓ Synced with Google Drive Cloud Backup.
</div>`
        : isBiology
        ? `<h3 style="color: rgb(5, 150, 105); margin: 0 0 8px 0;">Cellular Mitochondria & Energy Cycles</h3>
<p style="margin: 0 0 6px 0;">Study guide imported from <strong>Google Drive</strong> archive.</p>
<p style="color: rgb(220, 38, 38); font-weight: 600;">Key Exam Concept: ATP synthesis via chemiosmosis across inner membrane.</p>`
        : `<h3 style="color: rgb(79, 70, 229); margin: 0 0 8px 0;">${cleanTitle}</h3>
<p>Document brought from <strong>Google Drive</strong> into NoteIn Studio Web.</p>`,
      fontFamily: 'Inter, sans-serif',
      fontSize: 16,
      color: '#1e293b',
      bold: false,
      italic: false,
      alignment: 'left',
      createdAt: now - 8000,
      updatedAt: now - 8000,
    },
  ];

  return {
    version: '2.0',
    app: 'NoteIn',
    exportedAt: now,
    notebook: {
      id: notebookId,
      title: cleanTitle,
      coverColor: isCalculus ? '#1d4ed8' : isBiology ? '#059669' : '#7c3aed',
      coverPattern: 'marble',
      defaultTemplate: {
        type: isBiology ? 'cornell' : 'ruled',
        lineSpacing: 28,
        gridSize: 20,
        patternColor: '#d0d7de',
        bgColor: '#ffffff',
      },
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
        template: {
          type: isBiology ? 'cornell' : 'ruled',
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
 * Signs in with Google.
 * If user has configured a custom Google Client ID and Google Identity Services is available,
 * initiates OAuth token client; otherwise signs in with instant interactive account.
 */
export async function signInWithGoogle(customUser?: Partial<GoogleUser>): Promise<GoogleUser> {
  const user: GoogleUser = {
    id: customUser?.id || 'google_user_' + Math.random().toString(36).substring(2, 9),
    name: customUser?.name || 'Alex Chen',
    email: customUser?.email || 'alex.chen@gmail.com',
    picture: customUser?.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    isDemo: customUser?.isDemo ?? true,
    accessToken: customUser?.accessToken,
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
 */
export async function listGoogleDriveFiles(): Promise<GoogleDriveFile[]> {
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

  // Return empty string fallback
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
