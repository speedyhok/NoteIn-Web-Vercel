import { describe, it, expect } from 'vitest';
import { calculateBoundingBox, calculatePointWidth } from '../engine/spline';
import { distanceToSegment, doesBoundsOverlap, isStrokeIntersectedByEraser } from '../engine/eraser';
import { screenToPage, pageToScreen, clampZoom, fitPageToContainer } from '../engine/transform';
import type { Point, Stroke, ViewportTransform } from '../types';

describe('Spline and Bounds Engine', () => {
  it('calculates bounding box correctly with padding', () => {
    const points: Point[] = [
      { x: 10, y: 10, pressure: 0.5 },
      { x: 50, y: 30, pressure: 0.5 },
      { x: 100, y: 80, pressure: 0.5 },
    ];
    const width = 4;
    const bounds = calculateBoundingBox(points, width);

    // Padding = 4/2 + 2 = 4
    expect(bounds.minX).toBe(6);
    expect(bounds.minY).toBe(6);
    expect(bounds.maxX).toBe(104);
    expect(bounds.maxY).toBe(84);
  });

  it('scales stroke width with active stylus pressure', () => {
    const baseWidth = 10;
    // Low pressure -> thinner
    const lowPWidth = calculatePointWidth(baseWidth, { x: 0, y: 0, pressure: 0.1 });
    // High pressure -> thicker
    const highPWidth = calculatePointWidth(baseWidth, { x: 0, y: 0, pressure: 0.9 });

    expect(lowPWidth).toBeLessThan(baseWidth);
    expect(highPWidth).toBeGreaterThan(baseWidth);
    expect(highPWidth).toBeGreaterThan(lowPWidth);
  });

  it('returns base width for highlighter regardless of pressure', () => {
    const baseWidth = 20;
    const width = calculatePointWidth(baseWidth, { x: 0, y: 0, pressure: 0.9 }, undefined, true);
    expect(width).toBe(baseWidth);
  });
});

describe('Eraser Collision Engine', () => {
  it('calculates distance from point to line segment accurately', () => {
    const a: Point = { x: 0, y: 0, pressure: 0.5 };
    const b: Point = { x: 100, y: 0, pressure: 0.5 };

    // Point directly on segment
    expect(distanceToSegment({ x: 50, y: 0, pressure: 0.5 }, a, b)).toBe(0);

    // Point perpendicular to midpoint at distance 15
    expect(distanceToSegment({ x: 50, y: 15, pressure: 0.5 }, a, b)).toBeCloseTo(15);

    // Point before start point
    expect(distanceToSegment({ x: -10, y: 0, pressure: 0.5 }, a, b)).toBeCloseTo(10);

    // Point after end point
    expect(distanceToSegment({ x: 120, y: 0, pressure: 0.5 }, a, b)).toBeCloseTo(20);
  });

  it('detects bounding box overlap', () => {
    const b1 = { minX: 10, minY: 10, maxX: 50, maxY: 50 };
    const b2 = { minX: 40, minY: 40, maxX: 80, maxY: 80 };
    const b3 = { minX: 60, minY: 60, maxX: 90, maxY: 90 };

    expect(doesBoundsOverlap(b1, b2)).toBe(true);
    expect(doesBoundsOverlap(b1, b3)).toBe(false);
  });

  it('detects when eraser circle intersects a stroke', () => {
    const stroke: Stroke = {
      id: 's1',
      pageId: 'p1',
      toolType: 'pen',
      color: '#000000',
      width: 4,
      opacity: 1,
      points: [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 200, y: 100, pressure: 0.5 },
      ],
      bounds: { minX: 96, minY: 96, maxX: 204, maxY: 104 },
      createdAt: 100,
    };

    // Eraser at (150, 105) with radius 10 intersects stroke at (150, 100)
    expect(isStrokeIntersectedByEraser({ x: 150, y: 105, pressure: 0.5 }, 10, stroke)).toBe(true);

    // Eraser at (150, 200) with radius 10 is far away
    expect(isStrokeIntersectedByEraser({ x: 150, y: 200, pressure: 0.5 }, 10, stroke)).toBe(false);
  });
});

describe('Coordinate Transformation Engine', () => {
  const transform: ViewportTransform = {
    zoom: 2.0,
    panX: 50,
    panY: 30,
  };
  const canvasRect = {
    left: 100,
    top: 50,
    right: 900,
    bottom: 650,
    width: 800,
    height: 600,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect;

  it('transforms screen coordinates to page coordinates and inverts accurately', () => {
    const screenX = 350;
    const screenY = 250;

    const pagePt = screenToPage(screenX, screenY, canvasRect, transform);
    const screenPt = pageToScreen(pagePt.x, pagePt.y, canvasRect, transform);

    expect(screenPt.x).toBeCloseTo(screenX);
    expect(screenPt.y).toBeCloseTo(screenY);
  });

  it('clamps zoom within bounds', () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(10)).toBe(5.0);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('fits page into container centered', () => {
    const fit = fitPageToContainer(794, 1123, 1000, 800, 40);
    expect(fit.zoom).toBeGreaterThan(0);
    expect(fit.zoom).toBeLessThanOrEqual(1.0);
    // Pan should center the page horizontally and vertically
    expect(fit.panX).toBeGreaterThanOrEqual(0);
  });
});
