import { useState, useEffect, useCallback } from 'react';

interface UseZoomOptions {
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
  /** Minimum zoom level (default: 0.25) */
  minZoom?: number;
  /** Maximum zoom level (default: 3) */
  maxZoom?: number;
  /** Zoom step size (default: 0.1) */
  step?: number;
  /** Whether to enable wheel-based zoom (default: true) */
  enableWheelZoom?: boolean;
  /** Canvas selector for wheel event attachment (default: '[data-canvas="true"]') */
  canvasSelector?: string;
}

interface UseZoomReturn {
  /** Current zoom level */
  zoom: number;
  /** Function to update zoom level */
  updateZoom: (updater: (z: number) => number) => void;
  /** Function to reset zoom to initial level */
  resetZoom: () => void;
}

/**
 * Hook for managing canvas zoom functionality
 * 
 * Provides zoom state management and wheel-based zoom controls.
 * Prevents browser's native zoom when using Ctrl/Cmd + scroll.
 * 
 * @example
 * ```tsx
 * const { zoom, updateZoom, resetZoom } = useZoom({
 *   initialZoom: 1,
 *   minZoom: 0.25,
 *   maxZoom: 3,
 * });
 * ```
 */
export function useZoom({
  initialZoom = 1,
  minZoom = 0.25,
  maxZoom = 3,
  step = 0.1,
  enableWheelZoom = true,
  canvasSelector = '[data-canvas="true"]',
}: UseZoomOptions = {}): UseZoomReturn {
  const [zoom, setZoom] = useState<number>(initialZoom);

  // Helper to safely update zoom with clamping
  const updateZoom = useCallback((updater: (z: number) => number) => {
    setZoom(prev => {
      const next = updater(prev);
      // Clamp between minZoom and maxZoom
      return Math.min(maxZoom, Math.max(minZoom, +next.toFixed(2)));
    });
  }, [minZoom, maxZoom]);

  // Reset zoom to initial level
  const resetZoom = useCallback(() => {
    setZoom(initialZoom);
  }, [initialZoom]);

  // Handle wheel events with native listener to properly prevent browser zoom
  useEffect(() => {
    if (!enableWheelZoom) return;

    const handleWheel = (e: WheelEvent) => {
      // Use Ctrl key for zoom, but prevent Chrome's native zoom
      if (e.ctrlKey || e.metaKey) {
        // CRITICAL: Prevent Chrome's native zoom by preventing default
        // Must be called synchronously in capture phase BEFORE any other processing
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Only process zoom if we're over the canvas area
        const canvas = document.querySelector(canvasSelector) as HTMLElement;
        if (canvas) {
          // Check if the event target is within the canvas or its children
          const target = e.target as HTMLElement;
          const isOverCanvas = canvas.contains(target) || target === canvas;
          
          if (isOverCanvas) {
            // deltaY > 0 = scroll down (zoom out), deltaY < 0 = scroll up (zoom in)
            const direction = e.deltaY > 0 ? -step : step;

            // updateZoom clamps between minZoom and maxZoom
            updateZoom(z => z + direction);
          }
        }
        
        return false;
      }
    };

    // Use capture phase and non-passive to ensure preventDefault works
    // Attach to document in capture phase to catch events BEFORE Chrome processes them
    // This is more reliable than window for preventing native zoom
    const options: AddEventListenerOptions = { 
      passive: false, 
      capture: true 
    };
    
    // Attach to document (most reliable) and window for maximum coverage
    // Document is better than window for preventing Chrome's native zoom
    document.addEventListener('wheel', handleWheel, options);
    window.addEventListener('wheel', handleWheel, options);

    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [enableWheelZoom, canvasSelector, step, updateZoom]);

  return {
    zoom,
    updateZoom,
    resetZoom,
  };
}

