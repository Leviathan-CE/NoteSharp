import { useEffect, useRef } from 'react';

interface UseCanvasPanOptions {
  /** Canvas selector (default: '[data-canvas="true"]') */
  canvasSelector?: string;
  /** Whether panning is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook for panning the canvas with middle mouse button drag
 * 
 * Allows users to click and drag with the middle mouse button (mouse wheel button)
 * to pan/scroll the canvas in the direction of the drag.
 * 
 * @example
 * ```tsx
 * useCanvasPan({
 *   canvasSelector: '[data-canvas="true"]',
 *   enabled: true,
 * });
 * ```
 */
export function useCanvasPan({
  canvasSelector = '[data-canvas="true"]',
  enabled = true,
}: UseCanvasPanOptions = {}): void {
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = document.querySelector(canvasSelector) as HTMLElement;
    if (!canvas) return;

    canvasRef.current = canvas;

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle middle mouse button (button === 1)
      if (e.button !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };

      // Change cursor to hand/grabbing to indicate panning
      document.body.style.cursor = 'grabbing';
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !panStartRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      // Calculate how far the mouse has moved
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      // Update scroll position (inverse direction - drag right scrolls left)
      canvas.scrollLeft = panStartRef.current.scrollLeft - deltaX;
      canvas.scrollTop = panStartRef.current.scrollTop - deltaY;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isPanningRef.current) return;

      // Only stop panning if it's the middle button
      if (e.button === 1) {
        isPanningRef.current = false;
        panStartRef.current = null;

        // Restore cursor
        document.body.style.cursor = '';
        if (canvasRef.current) {
          canvasRef.current.style.cursor = '';
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent context menu when middle clicking
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    // Attach event listeners to canvas
    // Use capture phase (true) to intercept events before React handlers
    canvas.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    canvas.addEventListener('contextmenu', handleContextMenu, true);

    // Also handle mouseleave to stop panning if mouse leaves canvas
    const handleMouseLeave = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        document.body.style.cursor = '';
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'default';
        }
      }
    };

    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      canvas.removeEventListener('contextmenu', handleContextMenu, true);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      
      // Clean up cursor
      document.body.style.cursor = '';
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default';
      }
    };
  }, [enabled, canvasSelector]);
}

