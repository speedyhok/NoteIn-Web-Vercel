# NoteIn Web — Phase 1 MVP

A modern, high-performance web reconstruction of the **NoteIn** digital notebook application, built with React, TypeScript, Vite, HTML5 Canvas, and Dexie.js (IndexedDB).

## Features

### 1. Notebook Library
- Create notebooks with custom cover colors and patterns (`solid`, `marble`, `minimal`, `gradient`).
- Rename and delete notebooks with confirmation dialogs.
- Real-time timestamp tracking (`Created` and `Last Modified`).
- Cascading deletion (deleting a notebook purges all child pages and vector strokes).
- Search and filter notebooks in real time.
- Empty state with quick notebook creation.

### 2. Note Editor & Vector Canvas
- **Multi-layer Canvas Engine**:
  - `paperCanvas`: High-DPI rendered background templates (`blank`, `ruled`, `grid`, `dotted`, `cornell`).
  - `strokesCanvas`: Persisted vector stroke rendering with anti-aliasing and blend modes.
  - `activeCanvas`: Real-time active drawing layer with zero lag.
- **Pointer Events & Pressure Support**:
  - Full hardware stylus support (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
  - Native hardware pressure sensitivity with velocity-based fallback for standard mice/trackpads.
  - Prevents unwanted browser scroll gestures and text selection (`touch-action: none`).
- **Tools**:
  - **Pen**: Dynamic width scaling according to pressure, rounded caps, and fountain-pen style rendering.
  - **Highlighter**: Semi-transparent yellow/color tint rendered with `multiply` blend mode so underlying paper lines and text remain visible.
  - **Stroke Eraser**: Exact segment-to-point geometric distance collision detection (`distanceToSegment`) and bounding box pre-filtering. Deletes entire strokes seamlessly on sweep.
  - **Hand / Pan**: Click-and-drag panning.
  - **Zoom / Viewport**: Pinch-to-zoom and wheel zoom (`0.25x` to `5.0x`), center-on-zoom, and "Fit to Screen" action.
- **Undo / Redo**:
  - Stack-based `HistoryManager` supporting single stroke additions, deletions, and multi-stroke eraser batch sweeps.
  - Keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`).
  - Tool hotkeys (`1` for Pen, `2` for Highlighter, `3` for Eraser, `4` for Hand).

### 3. Page Management & Paper Templates
- Multi-page navigation with next/previous controls and slide-out page thumbnail drawer.
- Add new pages, duplicate existing pages (including duplicating vector strokes), and delete pages.
- Paper templates with live preview:
  - **Ruled**: Horizontal lined paper with vertical margin line.
  - **Grid**: Math graph paper.
  - **Dotted**: Bullet journal dot grid.
  - **Cornell**: Academic lecture notes layout (cue column, notes area, summary footer).
  - **Blank**: Clean canvas.

### 4. Persistence & Storage Layer
- **Dexie.js (IndexedDB)**:
  - Fully local, offline-first vector storage.
  - Stores discrete point arrays (`x`, `y`, `pressure`), tool types, bounding boxes, colors, and widths.
  - Debounced autosave (500ms) with visual status indicator (`Saved` / `Saving...`).
  - No localStorage size limitations.

### 5. UI Quality & Design System
- Modern glassmorphism floating pill toolbar (`NoteinGlassView` style with `backdrop-filter: blur(20px)`).
- Complete Light and Dark mode support with persistent preference.
- Fully responsive across desktop, tablet, and mobile screens.
- Original SVG and Lucide icons without proprietary APK asset extraction.

## Project Structure

```
Notein-Web/
├── index.html                     # Entry HTML with Inter typography & viewport settings
├── package.json                   # Dependencies (React 19, Vite, Dexie, Lucide, Vitest)
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite bundler configuration
└── src/
    ├── types/
    │   └── index.ts               # Core data models (Notebook, Page, Stroke, Point, History)
    ├── db/
    │   └── index.ts               # Dexie IndexedDB database & cascading CRUD operations
    ├── engine/
    │   ├── transform.ts           # Screen <-> Page coordinates & zoom clamping
    │   ├── spline.ts              # Pressure calculation, velocity fallback & bounding boxes
    │   ├── eraser.ts              # Geometric point-to-segment stroke collision detection
    │   ├── paper.ts               # Canvas paper template rendering (ruled, grid, dotted, etc.)
    │   ├── renderer.ts            # High-DPI stroke rendering & blend modes
    │   └── history.ts             # Command-pattern Undo/Redo stack manager
    ├── components/
    │   ├── common/
    │   │   └── Modal.tsx          # Accessible modal dialog with backdrop blur
    │   ├── library/
    │   │   ├── NotebookCard.tsx   # Library notebook item with cover preview & actions
    │   │   ├── CreateNotebookModal.tsx # New notebook modal with cover & template selection
    │   │   └── NotebookLibrary.tsx# Notebook gallery, search, theme switcher, empty state
    │   └── editor/
    │       ├── ColorPicker.tsx    # 12 curated NoteIn swatches + custom HEX picker
    │       ├── StrokeWidthPicker.tsx # Preset buttons + continuous slider + live preview
    │       ├── TemplateSelector.tsx  # Paper template modal with visual SVG cards
    │       ├── PageDrawer.tsx     # Slide-out page thumbnail drawer
    │       ├── Toolbar.tsx        # Floating glass pill toolbar
    │       ├── PaperCanvas.tsx    # Multi-layer Pointer Events drawing canvas
    │       └── NoteEditor.tsx     # Editor coordinator with debounced autosave & hotkeys
    ├── tests/
    │   ├── drawing.test.ts        # Tests for bounds, pressure scaling, collision, transforms
    │   ├── history.test.ts        # Tests for undo/redo stacks, batch eraser, stack limits
    │   └── persistence.test.ts    # Tests for Dexie CRUD, page duplication, cascading delete
    ├── App.tsx                    # Main router between Library and Editor views
    ├── index.css                  # CSS custom properties, glassmorphism, dark mode tokens
    └── main.tsx                   # React root entry point
```

## Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5173`.

### 3. Run the Unit & Integration Tests
```bash
npm test
```
Executes all 25 Vitest tests across engine, history, and persistence modules.

### 4. Build for Production
```bash
npm run build
```
Typechecks with `tsc -b` and bundles into `/dist`.

## Remaining Limitations (Phase 1 MVP)

1. **Selection / Lasso Tool**: Phase 1 includes the UI placeholder for the selection tool; freehand lasso point-in-polygon selection, translation, and rotation will be implemented in Phase 2.
2. **Infinite Canvas**: Phase 1 uses standard page layouts (A4 aspect ratio); continuous vertical infinite-scrolling canvas is planned for Phase 2.
3. **PDF Import / Export**: PDF rendering via PDF.js and raster/vector PDF export will be added in Phase 2.
4. **Cloud / WebDAV Sync**: Current version persists completely client-side in browser IndexedDB.
