/**
 * NoteIn Web Core Type Definitions
 * Replicates the data architecture decompiled from NoteIn APK (com.orion.penkit & Room entities)
 */

export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'text' | 'pan';

export type PenStyle = 'ballpoint' | 'fountain' | 'pencil';

export type PaperType = 'blank' | 'ruled' | 'grid' | 'dotted' | 'cornell';

export interface Point {
  x: number;
  y: number;
  pressure: number; // 0.0 to 1.0
  time?: number;    // timestamp ms
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Stroke {
  id: string;
  pageId: string;
  toolType: ToolType;
  penStyle?: PenStyle;
  color: string;       // HEX or RGBA
  width: number;       // Base thickness in pt
  opacity: number;     // 0.0 to 1.0 (e.g. 0.4 for highlighter)
  points: Point[];
  bounds: BoundingBox;
  createdAt: number;
}

export interface TextBox {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontFamily: string;
  fontSize: number;    // pt (e.g. 16)
  color: string;       // HEX
  bold: boolean;
  italic: boolean;
  alignment: 'left' | 'center' | 'right';
  createdAt: number;
  updatedAt: number;
}

export interface PaperTemplate {
  type: PaperType;
  lineSpacing: number; // pt (e.g. 28)
  gridSize: number;    // pt (e.g. 20)
  patternColor: string;// HEX (e.g. #d0d7de or dark mode equivalent)
  bgColor: string;     // HEX (e.g. #ffffff, #fffdf8, #1e1e24)
}

export interface Page {
  id: string;
  notebookId: string;
  pageNumber: number;
  title: string;
  template: PaperTemplate;
  width: number;       // Standard A4 width in pt: 794
  height: number;      // Standard A4 height in pt: 1123
  isUnbounded?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  id: string;
  title: string;
  coverColor: string;
  coverPattern: 'solid' | 'marble' | 'minimal' | 'gradient';
  defaultTemplate: PaperTemplate;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
}

export interface ViewportTransform {
  zoom: number;       // e.g. 1.0 = 100%
  panX: number;       // Screen pixels
  panY: number;       // Screen pixels
}

export interface PenPreset {
  id: string;
  toolType: ToolType;
  penStyle: PenStyle;
  color: string;
  width: number;
}

export type HistoryAction = 
  | { type: 'ADD_STROKE'; stroke: Stroke }
  | { type: 'DELETE_STROKE'; stroke: Stroke }
  | { type: 'DELETE_STROKES'; strokes: Stroke[] }
  | { type: 'ADD_TEXT_BOX'; textBox: TextBox }
  | { type: 'DELETE_TEXT_BOX'; textBox: TextBox }
  | { type: 'UPDATE_TEXT_BOX'; prev: TextBox; current: TextBox }
  | { type: 'CHANGE_TEMPLATE'; pageId: string; prevTemplate: PaperTemplate; nextTemplate: PaperTemplate };
