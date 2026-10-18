import type { ViewportTransform } from '../types';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5.0;

export function screenToPage(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  transform: ViewportTransform
): { x: number; y: number } {
  const relativeX = screenX - canvasRect.left;
  const relativeY = screenY - canvasRect.top;

  return {
    x: (relativeX - transform.panX) / transform.zoom,
    y: (relativeY - transform.panY) / transform.zoom,
  };
}

export function pageToScreen(
  pageX: number,
  pageY: number,
  canvasRect: DOMRect,
  transform: ViewportTransform
): { x: number; y: number } {
  return {
    x: canvasRect.left + (pageX * transform.zoom + transform.panX),
    y: canvasRect.top + (pageY * transform.zoom + transform.panY),
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitPageToContainer(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding: number = 40
): ViewportTransform {
  const availW = Math.max(100, containerWidth - padding * 2);
  const availH = Math.max(100, containerHeight - padding * 2);

  const scaleW = availW / pageWidth;
  const scaleH = availH / pageHeight;
  const zoom = clampZoom(Math.min(scaleW, scaleH));

  const renderedW = pageWidth * zoom;
  const renderedH = pageHeight * zoom;

  const panX = (containerWidth - renderedW) / 2;
  const panY = (containerHeight - renderedH) / 2;

  return { zoom, panX, panY };
}
