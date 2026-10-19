// Tests for Real Google Identity Services (GIS) & Google Drive / Picker Integration
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

declare const Buffer: any;

function toBase64Url(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64url');
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Polyfill in-memory localStorage and sessionStorage for Node test environment
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      writable: true,
    });
  }
  if (typeof globalThis.sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: new MemoryStorage(),
      writable: true,
    });
  }
});

import {
  parseGoogleJwt,
  getGoogleClientId,
  getGoogleApiKey,
  getGoogleAppId,
  saveUserGoogleCredentials,
  clearUserGoogleCredentials,
  getCredentialStatus,
  getGoogleUser,
  saveGoogleUser,
  clearGoogleUser,
  DRIVE_FILE_SCOPE,
  downloadDriveFile,
  type GooglePickedFile,
} from '../services/googleDriveService';
import type { GoogleUser } from '../types';

describe('Google Identity Services (GIS) & Drive Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('JWT Payload Decoding (Phase 2)', () => {
    it('accurately decodes Google Identity Services JWT claims', () => {
      const mockClaims = {
        iss: 'https://accounts.google.com',
        sub: '109876543210987654321',
        azp: '1234567890-test.apps.googleusercontent.com',
        aud: '1234567890-test.apps.googleusercontent.com',
        email: 'scholar@gmail.com',
        email_verified: true,
        name: 'Marie Curie',
        picture: 'https://lh3.googleusercontent.com/a/ACg8ocL...',
        given_name: 'Marie',
        family_name: 'Curie',
        iat: 1700000000,
        exp: 1700003600,
      };

      // Construct valid 3-part base64url JWT
      const header = toBase64Url(JSON.stringify({ alg: 'RS256', kid: '123' }));
      const payload = toBase64Url(JSON.stringify(mockClaims));
      const signature = 'mock_signature_bytes';
      const rawToken = `${header}.${payload}.${signature}`;

      const decoded = parseGoogleJwt(rawToken);

      expect(decoded.sub).toBe('109876543210987654321');
      expect(decoded.name).toBe('Marie Curie');
      expect(decoded.email).toBe('scholar@gmail.com');
      expect(decoded.picture).toBe('https://lh3.googleusercontent.com/a/ACg8ocL...');
      expect(decoded.email_verified).toBe(true);
    });

    it('handles unicode characters in user names correctly', () => {
      const unicodeClaims = {
        sub: '987654321',
        name: 'Élodie Renée Müller (陈敏)',
        email: 'elodie@example.org',
      };

      const header = toBase64Url(JSON.stringify({ alg: 'RS256' }));
      const payload = toBase64Url(JSON.stringify(unicodeClaims));
      const rawToken = `${header}.${payload}.signature`;

      const decoded = parseGoogleJwt(rawToken);
      expect(decoded.name).toBe('Élodie Renée Müller (陈敏)');
      expect(decoded.email).toBe('elodie@example.org');
    });

    it('rejects malformed or empty tokens with clear descriptive error', () => {
      expect(() => parseGoogleJwt('')).toThrow('Credential token is empty or invalid.');
      expect(() => parseGoogleJwt('not.enough.parts.here.extra')).toThrow('Invalid JWT token structure');
      expect(() => parseGoogleJwt('single_part_string')).toThrow('Invalid JWT token structure');
    });
  });

  describe('Credential Validation & Project Number Derivation (Phase 5)', () => {
    it('manages manual user credentials correctly in local storage', () => {
      clearUserGoogleCredentials();
      expect(getGoogleClientId()).toBe('');
      expect(getGoogleApiKey()).toBe('');
      expect(getGoogleAppId()).toBe('');

      saveUserGoogleCredentials(
        '987654321098-abcdefgh.apps.googleusercontent.com',
        'AIzaSyD-TEST-API-KEY-12345',
        '987654321098'
      );

      expect(getGoogleClientId()).toBe('987654321098-abcdefgh.apps.googleusercontent.com');
      expect(getGoogleApiKey()).toBe('AIzaSyD-TEST-API-KEY-12345');
      expect(getGoogleAppId()).toBe('987654321098');

      const status = getCredentialStatus();
      expect(status.hasClientId).toBe(true);
      expect(status.hasApiKey).toBe(true);
      expect(status.isFullyConfigured).toBe(true);
    });

    it('automatically derives Project Number from standard Client ID if App ID is omitted', () => {
      clearUserGoogleCredentials();
      saveUserGoogleCredentials(
        '554433221100-testapp.apps.googleusercontent.com',
        'AIzaSyTestKey'
      );

      expect(getGoogleAppId()).toBe('554433221100');
    });

    it('clears credentials completely on reset', () => {
      saveUserGoogleCredentials('test_client_id', 'test_api_key', '12345');
      clearUserGoogleCredentials();

      expect(getGoogleClientId()).toBe('');
      expect(getGoogleApiKey()).toBe('');
      expect(getGoogleAppId()).toBe('');
      expect(getCredentialStatus().isFullyConfigured).toBe(false);
    });
  });

  describe('User Authentication State Management (Phase 2)', () => {
    it('never invents fake users when storage is empty', () => {
      clearGoogleUser();
      const user = getGoogleUser();
      expect(user).toBeNull();
    });

    it('persists and retrieves authentic Google user information', () => {
      const authUser: GoogleUser = {
        id: '123456789',
        name: 'Ada Lovelace',
        email: 'ada@computing.org',
        picture: 'https://example.com/avatar.png',
        isLiveDrive: true,
      };

      saveGoogleUser(authUser);
      const retrieved = getGoogleUser();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('123456789');
      expect(retrieved?.name).toBe('Ada Lovelace');
      expect(retrieved?.email).toBe('ada@computing.org');
      expect(retrieved?.picture).toBe('https://example.com/avatar.png');
    });

    it('cleans up user state on sign out', () => {
      const authUser: GoogleUser = {
        id: '12345',
        name: 'Test User',
        email: 'test@example.com',
        picture: '',
      };
      saveGoogleUser(authUser);
      expect(getGoogleUser()).not.toBeNull();

      clearGoogleUser();
      expect(getGoogleUser()).toBeNull();
    });
  });

  describe('Drive Scope Verification (Phase 3)', () => {
    it('uses the least-privilege drive.file scope for Google Picker operations', () => {
      expect(DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    });
  });

  describe('Google Drive File Download & Workspace Export (Phase 3 & 4)', () => {
    beforeEach(() => {
      saveUserGoogleCredentials('test_client_id.apps.googleusercontent.com', 'test_api_key');
    });

    it('exports Google Docs documents to PDF format via export endpoint', async () => {
      const mockFile: GooglePickedFile = {
        id: 'gdoc_123',
        name: 'Meeting Minutes',
        mimeType: 'application/vnd.google-apps.document',
      };

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('https://www.googleapis.com/drive/v3/files/gdoc_123/export?mimeType=application/pdf');
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      (globalThis as any).window = {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }: any) => ({
                requestAccessToken: () => callback({ access_token: 'mock_access_token_123', expires_in: 3600 }),
              }),
            },
          },
        },
      };

      const downloaded = await downloadDriveFile(mockFile);
      expect(downloaded.filename).toBe('Meeting Minutes.pdf');
      expect(downloaded.mimeType).toBe('application/pdf');
      expect(downloaded.data).toBeInstanceOf(ArrayBuffer);
    });

    it('downloads NoteIn package files as text json via ?alt=media', async () => {
      const mockFile: GooglePickedFile = {
        id: 'notein_456',
        name: 'Vector_Physics.notein',
        mimeType: 'application/x-notein',
      };

      const sampleNoteinJson = JSON.stringify({
        version: '2.0',
        app: 'NoteIn',
        notebook: { title: 'Vector Physics' },
        pages: [],
        strokes: [],
        textBoxes: [],
      });

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        expect(url).toContain('https://www.googleapis.com/drive/v3/files/notein_456?alt=media');
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(sampleNoteinJson),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const downloaded = await downloadDriveFile(mockFile);
      expect(downloaded.filename).toBe('Vector_Physics.notein');
      expect(typeof downloaded.data).toBe('string');
      expect(downloaded.data).toContain('"app":"NoteIn"');
    });

    it('honestly throws a clear error on HTTP 403 permission denied', async () => {
      const mockFile: GooglePickedFile = {
        id: 'restricted_789',
        name: 'Confidential_Document.pdf',
        mimeType: 'application/pdf',
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Insufficient permissions'),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(downloadDriveFile(mockFile)).rejects.toThrow(
        'Permission denied for "Confidential_Document.pdf"'
      );
    });
  });
});
