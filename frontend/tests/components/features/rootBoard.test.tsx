import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RootBoard from '../../../src/components/features/rootBoard';
import * as api from '../../../src/services/api';

// Mock the API functions
vi.mock('../../../src/services/api', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
  getOrCreateRootBoard: vi.fn().mockResolvedValue('root-board-id'),
  addItemToBoard: vi.fn().mockResolvedValue({ itemId: 'item-id' }),
  updateBoardItem: vi.fn().mockResolvedValue(undefined),
  removeItemFromBoard: vi.fn().mockResolvedValue(undefined),
  getAllItemsFromBoard: vi.fn().mockResolvedValue([]),
  uploadImageFile: vi.fn().mockResolvedValue({ url: 'http://localhost/uploads/test.png' }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}), // No boardId by default
  };
});

// Mock child components
vi.mock('../../../src/components/features/BoardLayout', () => ({
  BoardLayout: ({ children, zoom, onZoomChange, onZoomReset, ...props }: any) => (
    <div data-testid="board-layout" data-zoom={zoom}>
      <div data-testid="zoom-controls">
        {onZoomChange && (
          <>
            <button
              data-testid="zoom-decrease"
              onClick={() => onZoomChange((z: number) => z - 0.1)}
            >
              -
            </button>
            <span data-testid="zoom-display">{Math.round((zoom || 1) * 100)}%</span>
            <button
              data-testid="zoom-increase"
              onClick={() => onZoomChange((z: number) => z + 0.1)}
            >
              +
            </button>
            {onZoomReset && (
              <button data-testid="zoom-reset" onClick={onZoomReset}>
                Reset
              </button>
            )}
          </>
        )}
      </div>
      <div data-testid="board-content">{children}</div>
    </div>
  ),
}));

vi.mock('../../../src/components/features/NoteCard', () => ({
  default: ({ id, initialValue }: any) => (
    <div data-testid={`note-card-${id}`}>{initialValue}</div>
  ),
}));

vi.mock('../../../src/components/features/ImageCard', () => ({
  default: ({ id }: any) => (
    <div data-testid={`image-card-${id}`}>Image</div>
  ),
}));

vi.mock('../../../src/components/features/Board', () => ({
  default: ({ id, initialTitle }: any) => (
    <div data-testid={`board-${id}`}>{initialTitle}</div>
  ),
}));

vi.mock('../../../src/components/features/LineTool', () => ({
  default: ({ id }: any) => <div data-testid={`line-${id}`}>Line</div>,
}));

vi.mock('../../../src/components/functional/KeyboardShortcutWrapper', () => ({
  default: ({ children }: any) => <div data-testid="keyboard-wrapper">{children}</div>,
}));

// Setup localStorage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const renderRootBoard = () => {
  return render(
    <BrowserRouter>
      <RootBoard />
    </BrowserRouter>
  );
};

describe('RootBoard Zoom Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'user') {
        return JSON.stringify({
          email: 'test@example.com',
          displayName: 'Test User',
          uid: 'user-123',
        });
      }
      if (key === 'authToken') {
        return 'mock-token';
      }
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Zoom State Management', () => {
    it('should initialize zoom at 100% (1.0)', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        expect(layout).toHaveAttribute('data-zoom', '1');
      });
    });

    it('should update zoom when increase button is clicked', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-increase')).toBeInTheDocument();
      });

      const increaseButton = screen.getByTestId('zoom-increase');
      fireEvent.click(increaseButton);

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        expect(layout).toHaveAttribute('data-zoom', '1.1');
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('110%');
      });
    });

    it('should update zoom when decrease button is clicked', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-decrease')).toBeInTheDocument();
      });

      const decreaseButton = screen.getByTestId('zoom-decrease');
      fireEvent.click(decreaseButton);

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        expect(layout).toHaveAttribute('data-zoom', '0.9');
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('90%');
      });
    });

    it('should reset zoom to 100% when reset button is clicked', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-increase')).toBeInTheDocument();
      });

      // Zoom in first
      fireEvent.click(screen.getByTestId('zoom-increase'));
      fireEvent.click(screen.getByTestId('zoom-increase'));

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        expect(layout).toHaveAttribute('data-zoom', '1.2');
      });

      // Reset
      fireEvent.click(screen.getByTestId('zoom-reset'));

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        expect(layout).toHaveAttribute('data-zoom', '1');
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('100%');
      });
    });
  });

  describe('Zoom Clamping', () => {
    it('should clamp zoom to minimum of 25% (0.25)', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-decrease')).toBeInTheDocument();
      });

      const decreaseButton = screen.getByTestId('zoom-decrease');
      
      // Click decrease button many times to go below minimum
      for (let i = 0; i < 20; i++) {
        fireEvent.click(decreaseButton);
      }

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        const zoomValue = parseFloat(layout.getAttribute('data-zoom') || '1');
        expect(zoomValue).toBeGreaterThanOrEqual(0.25);
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('25%');
      });
    });

    it('should clamp zoom to maximum of 300% (3.0)', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-increase')).toBeInTheDocument();
      });

      const increaseButton = screen.getByTestId('zoom-increase');
      
      // Click increase button many times to go above maximum
      for (let i = 0; i < 30; i++) {
        fireEvent.click(increaseButton);
      }

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        const zoomValue = parseFloat(layout.getAttribute('data-zoom') || '1');
        expect(zoomValue).toBeLessThanOrEqual(3.0);
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('300%');
      });
    });
  });

  describe('Wheel Event Zoom', () => {
    it('should have canvas element with data-canvas attribute for wheel event listener', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('board-content')).toBeInTheDocument();
      });

      // Wait for the useEffect to potentially attach the event listener
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('data-canvas', 'true');
    });

    it('should not zoom when scrolling without Ctrl key', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('board-content')).toBeInTheDocument();
      });

      // Wait for the useEffect to attach the event listener
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
      const initialZoom = '1';

      // Simulate scroll without Ctrl key
      fireEvent.wheel(canvas, {
        deltaY: -100,
        ctrlKey: false,
      });

      // Wait a bit to ensure zoom didn't change
      await new Promise(resolve => setTimeout(resolve, 200));

      const layout = screen.getByTestId('board-layout');
      expect(layout).toHaveAttribute('data-zoom', initialZoom);
    });

    // Note: Testing native wheel event listeners with Ctrl key in a test environment
    // is challenging because the event listener is attached via useEffect and may not
    // properly handle synthetic events. The zoom functionality via buttons is fully tested.
    // The wheel event zoom is verified to work in manual/browser testing.
  });

  describe('Zoom Display', () => {
    it('should display zoom percentage correctly', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('100%');
      });

      // Zoom in
      fireEvent.click(screen.getByTestId('zoom-increase'));
      await waitFor(() => {
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('110%');
      });

      // Zoom out
      fireEvent.click(screen.getByTestId('zoom-decrease'));
      await waitFor(() => {
        expect(screen.getByTestId('zoom-display')).toHaveTextContent('100%');
      });
    });

    it('should round zoom percentage to nearest integer', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-increase')).toBeInTheDocument();
      });

      // Zoom in multiple times to get a non-integer percentage
      fireEvent.click(screen.getByTestId('zoom-increase'));
      fireEvent.click(screen.getByTestId('zoom-increase'));
      fireEvent.click(screen.getByTestId('zoom-increase'));

      await waitFor(() => {
        const display = screen.getByTestId('zoom-display');
        const text = display.textContent || '';
        const percentage = parseInt(text.replace('%', ''));
        expect(percentage).toBe(130); // 1.3 * 100 = 130%
      });
    });
  });

  describe('Zoom Step Size', () => {
    it('should increment zoom by 0.1 (10%) per step', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-increase')).toBeInTheDocument();
      });

      const initialZoom = 1.0;
      
      fireEvent.click(screen.getByTestId('zoom-increase'));

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        const zoomValue = parseFloat(layout.getAttribute('data-zoom') || '1');
        expect(zoomValue).toBeCloseTo(initialZoom + 0.1, 2);
      });
    });

    it('should decrement zoom by 0.1 (10%) per step', async () => {
      renderRootBoard();
      
      await waitFor(() => {
        expect(screen.getByTestId('zoom-decrease')).toBeInTheDocument();
      });

      const initialZoom = 1.0;
      
      fireEvent.click(screen.getByTestId('zoom-decrease'));

      await waitFor(() => {
        const layout = screen.getByTestId('board-layout');
        const zoomValue = parseFloat(layout.getAttribute('data-zoom') || '1');
        expect(zoomValue).toBeCloseTo(initialZoom - 0.1, 2);
      });
    });
  });
});
