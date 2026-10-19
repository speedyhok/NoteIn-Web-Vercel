// Ambient types for Google Identity Services (GIS), Google APIs (gapi), and Google Picker API

declare namespace google {
  namespace accounts {
    namespace id {
      interface CredentialResponse {
        credential: string; // The JWT ID token
        select_by?: 'auto' | 'user' | 'user_1tap' | 'user_2tap' | 'btn' | 'btn_confirm' | 'br';
        clientId?: string;
      }

      interface GsiButtonConfiguration {
        type?: 'standard' | 'icon';
        theme?: 'outline' | 'filled_blue' | 'filled_black';
        size?: 'large' | 'medium' | 'small';
        text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
        shape?: 'rectangular' | 'pill' | 'circle' | 'square';
        logo_alignment?: 'left' | 'center';
        width?: number | string;
        locale?: string;
      }

      interface IdConfiguration {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: 'signin' | 'signup' | 'use';
        prompt_parent_id?: string;
      }

      interface PromptMomentNotification {
        isDisplayMoment: () => boolean;
        isDisplayed: () => boolean;
        isNotDisplayed: () => boolean;
        getNotDisplayedReason: () => string;
        isSkippedMoment: () => boolean;
        getSkippedReason: () => string;
        isDismissedMoment: () => boolean;
        getDismissedReason: () => string;
        getMomentType: () => string;
      }

      function initialize(config: IdConfiguration): void;
      function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
      function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
      function disableAutoSelect(): void;
      function storeCredential(credential: any, callback?: () => void): void;
      function cancel(): void;
      function revoke(hint: string, callback?: (done: { successful: boolean; error?: string }) => void): void;
    }

    namespace oauth2 {
      interface TokenResponse {
        access_token: string;
        expires_in: number;
        hd?: string;
        prompt?: string;
        token_type: string;
        scope: string;
        state?: string;
        error?: string;
        error_description?: string;
        error_uri?: string;
      }

      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string; message: string }) => void;
        hint?: string;
        hosted_domain?: string;
        prompt?: '' | 'none' | 'consent' | 'select_account';
      }

      interface TokenClient {
        requestAccessToken(overrideConfig?: { prompt?: string; hint?: string }): void;
      }

      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(accessToken: string, done?: () => void): void;
      function hasGrantedAllScopes(tokenResponse: TokenResponse, firstScope: string, ...restScopes: string[]): boolean;
      function hasGrantedAnyScope(tokenResponse: TokenResponse, firstScope: string, ...restScopes: string[]): boolean;
    }
  }

  namespace picker {
    enum Action {
      CANCEL = 'cancel',
      PICKED = 'picked',
      LOADED = 'loaded',
    }

    enum Response {
      ACTION = 'action',
      DOCUMENTS = 'docs',
      PARENTS = 'parents',
      VIEW = 'view',
    }

    enum Document {
      DESCRIPTION = 'description',
      DURATION = 'duration',
      EMBEDDABLE_URL = 'embeddableUrl',
      ICON_URL = 'iconUrl',
      ID = 'id',
      IS_NEW = 'isNew',
      LAST_EDITED_UTC = 'lastEditedUtc',
      MIME_TYPE = 'mimeType',
      NAME = 'name',
      NUM_CHILDREN = 'numChildren',
      PARENT_ID = 'parentId',
      SERVICE_ID = 'serviceId',
      SIZE_BYTES = 'sizeBytes',
      THUMBNAILS = 'thumbnails',
      TYPE = 'type',
      URL = 'url',
    }

    enum ViewId {
      DOCS = 'all',
      DOCS_IMAGES = 'docs-images',
      DOCS_IMAGES_AND_VIDEOS = 'docs-images-and-videos',
      DOCS_VIDEOS = 'docs-videos',
      DOCUMENTS = 'documents',
      DRAWINGS = 'drawings',
      FOLDERS = 'folders',
      FORMS = 'forms',
      IMAGE_SEARCH = 'image-search',
      PDFS = 'pdfs',
      PRESENTATIONS = 'presentations',
      SPREADSHEETS = 'spreadsheets',
      RECENTLY_PICKED = 'recently-picked',
    }

    enum Feature {
      MINE_ONLY = 'mineOnly',
      MULTISELECT_ENABLED = 'multiselectEnabled',
      NAV_HIDDEN = 'navHidden',
      SIMPLE_UPLOAD_ENABLED = 'simpleUploadEnabled',
      SUPPORT_DRIVES = 'supportDrives',
      SUPPORT_TEAM_DRIVES = 'supportTeamDrives',
    }

    interface PickerResultDoc {
      id: string;
      name: string;
      mimeType: string;
      sizeBytes?: number;
      lastEditedUtc?: number;
      iconUrl?: string;
      url?: string;
      description?: string;
      [key: string]: any;
    }

    interface PickerCallbackData {
      action: string;
      docs?: PickerResultDoc[];
      [key: string]: any;
    }

    class DocsView {
      constructor(viewId?: ViewId | string);
      setIncludeFolders(include: boolean): DocsView;
      setSelectFolderEnabled(enabled: boolean): DocsView;
      setMimeTypes(mimeTypes: string): DocsView;
      setMode(mode: any): DocsView;
      setParent(parentId: string): DocsView;
      setQuery(query: string): DocsView;
      setStarred(starred: boolean): DocsView;
    }

    class DocsUploadView {
      constructor();
      setIncludeFolders(include: boolean): DocsUploadView;
      setParent(parentId: string): DocsUploadView;
    }

    class Picker {
      setVisible(visible: boolean): void;
      dispose(): void;
    }

    class PickerBuilder {
      constructor();
      addView(view: any): PickerBuilder;
      addViewGroup(viewGroup: any): PickerBuilder;
      enableFeature(feature: Feature | string): PickerBuilder;
      disableFeature(feature: Feature | string): PickerBuilder;
      setAppId(appId: string): PickerBuilder;
      setDeveloperKey(key: string): PickerBuilder;
      setOAuthToken(token: string): PickerBuilder;
      setCallback(callback: (data: PickerCallbackData) => void): PickerBuilder;
      setTitle(title: string): PickerBuilder;
      setSize(width: number, height: number): PickerBuilder;
      setOrigin(origin: string): PickerBuilder;
      build(): Picker;
    }
  }
}

declare namespace gapi {
  function load(
    apiName: string,
    callbackOrConfig:
      | (() => void)
      | {
          callback: () => void;
          onerror?: () => void;
          timeout?: number;
          ontimeout?: () => void;
        }
  ): void;

  namespace client {
    function init(args: { apiKey?: string; discoveryDocs?: string[]; clientId?: string; scope?: string }): Promise<void>;
    function setToken(token: { access_token: string } | null): void;
    function getToken(): { access_token: string } | null;
  }
}

interface Window {
  google?: typeof google;
  gapi?: typeof gapi;
}
