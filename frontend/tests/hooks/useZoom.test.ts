import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoom } from '../../src/hooks/useZoom';

describe('useZoom Hook', () => {
  beforeEach(() => {
    // Clean up any existing event listeners
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default zoom of 1', () => {
      const { result } = renderHook(() => useZoom());
      expect(result.current.zoom).toBe(1);
    });

    it('should initialize with custom initial zoom', () => {
      const { result } = renderHook(() => useZoom({ initialZoom: 0.5 }));
      expect(result.current.zoom).toBe(0.5);
    });
  });

  describe('updateZoom', () => {
    it('should update zoom level', () => {
      const { result } = renderHook(() => useZoom());
      
      act(() => {
        result.current.updateZoom(z => z + 0.1);
      });

      expect(result.current.zoom).toBe(1.1);
    });

    it('should clamp zoom to minimum value', () => {
      const { result } = renderHook(() => useZoom({ minZoom: 0.25 }));
      
      act(() => {
        result.current.updateZoom(z => z - 1); // Try to go below minimum
      });

      expect(result.current.zoom).toBe(0.25);
    });

    it('should clamp zoom to maximum value', () => {
      const { result } = renderHook(() => useZoom({ maxZoom: 3 }));
      
      act(() => {
        result.current.updateZoom(z => z + 5); // Try to go above maximum
      });

      expect(result.current.zoom).toBe(3);
    });

    it('should handle custom updater functions', () => {
      const { result } = renderHook(() => useZoom({ initialZoom: 1 }));
      
      act(() => {
        result.current.updateZoom(z => z * 2);
      });

      expect(result.current.zoom).toBe(2);
    });

    it('should round zoom to 2 decimal places', () => {
      const { result } = renderHook(() => useZoom());
      
      act(() => {
        result.current.updateZoom(z => z + 0.123456);
      });

      expect(result.current.zoom).toBe(1.12);
    });
  });

  describe('resetZoom', () => {
    it('should reset zoom to initial value', () => {
      const { result } = renderHook(() => useZoom({ initialZoom: 1 }));
      
      // Change zoom
      act(() => {
        result.current.updateZoom(z => z + 0.5);
      });
      expect(result.current.zoom).toBe(1.5);

      // Reset zoom
      act(() => {
        result.current.resetZoom();
      });
      expect(result.current.zoom).toBe(1);
    });

    it('should reset to custom initial zoom', () => {
      const { result } = renderHook(() => useZoom({ initialZoom: 0.75 }));
      
      act(() => {
        result.current.updateZoom(z => z + 1);
      });
      
      act(() => {
        result.current.resetZoom();
      });

      expect(result.current.zoom).toBe(0.75);
    });
  });

  describe('wheel zoom', () => {
    beforeEach(() => {
      // Create a mock canvas element
      const mockCanvas = document.createElement('div');
      mockCanvas.setAttribute('data-canvas', 'true');
      document.body.appendChild(mockCanvas);
    });

    afterEach(() => {
      // Clean up mock canvas
      const canvas = document.querySelector('[data-canvas="true"]');
      if (canvas) {
        canvas.remove();
      }
    });

    it('should attach wheel event listener when enabled', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      renderHook(() => useZoom({ enableWheelZoom: true }));
      
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.objectContaining({ passive: false, capture: true })
      );
      
      addEventListenerSpy.mockRestore();
    });

    it('should not attach wheel event listener when disabled', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      renderHook(() => useZoom({ enableWheelZoom: false }));
      
      // Should not be called with wheel event
      const wheelCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'wheel'
      );
      expect(wheelCalls.length).toBe(0);
      
      addEventListenerSpy.mockRestore();
    });

    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useZoom());
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.objectContaining({ capture: true })
      );
      
      removeEventListenerSpy.mockRestore();
    });
  });
});

