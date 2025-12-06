/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from '../../src/hooks/useSelection';
import { CardData, BoardData, LineData } from '../../src/types/boardTypes';

describe('useSelection Hook', () => {
  const mockCards: CardData[] = [
    { id: 'card1', position: { x: 100, y: 100 }, size: { width: 200, height: 150 }, content: 'Card 1' },
    { id: 'card2', position: { x: 400, y: 400 }, size: { width: 200, height: 150 }, content: 'Card 2' },
  ];

  const mockBoards: BoardData[] = [
    { id: 'board1', position: { x: 200, y: 200 }, title: 'Board 1', cardCount: 0 },
  ];

  const mockLines: LineData[] = [
    { id: 'line1', startPoint: { x: 50, y: 50 }, endPoint: { x: 150, y: 150 } },
  ];

  describe('initialization', () => {
    it('should initialize with empty selection', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.isSelecting).toBe(false);
      expect(result.current.selectionBoxStart).toBeNull();
      expect(result.current.selectionBoxEnd).toBeNull();
    });
  });

  describe('handleItemClick', () => {
    it('should select single item on click', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      act(() => {
        result.current.handleItemClick('card1', false, false, false);
      });

      expect(result.current.selectedIds.has('card1')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);
    });

    it('should toggle selection with Ctrl key', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      // Select first item
      act(() => {
        result.current.handleItemClick('card1', true, false, false);
      });
      expect(result.current.selectedIds.has('card1')).toBe(true);

      // Add second item with Ctrl
      act(() => {
        result.current.handleItemClick('card2', true, false, false);
      });
      expect(result.current.selectedIds.size).toBe(2);
      expect(result.current.selectedIds.has('card1')).toBe(true);
      expect(result.current.selectedIds.has('card2')).toBe(true);

      // Remove first item with Ctrl
      act(() => {
        result.current.handleItemClick('card1', true, false, false);
      });
      expect(result.current.selectedIds.size).toBe(1);
      expect(result.current.selectedIds.has('card1')).toBe(false);
      expect(result.current.selectedIds.has('card2')).toBe(true);
    });

    it('should toggle selection with Shift key', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      act(() => {
        result.current.handleItemClick('card1', false, true, false);
      });
      expect(result.current.selectedIds.has('card1')).toBe(true);

      act(() => {
        result.current.handleItemClick('card2', false, true, false);
      });
      expect(result.current.selectedIds.size).toBe(2);
    });

    it('should not change selection if just finished dragging', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      // Set the flag as if we just finished dragging
      result.current.justFinishedDraggingRef.current = true;

      act(() => {
        result.current.handleItemClick('card1', false, false, false);
      });

      // Selection should not change
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('selection box', () => {
    it('should start selection box on canvas mouse down', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      const mockEvent = {
        target: document.createElement('div'),
        currentTarget: document.createElement('div'),
        button: 0,
        clientX: 150,
        clientY: 150,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      } as unknown as React.MouseEvent;

      // Mock getBoundingClientRect
      Object.defineProperty(mockEvent.currentTarget, 'getBoundingClientRect', {
        value: () => ({
          left: 0,
          top: 0,
          width: 1000,
          height: 1000,
        }),
      });

      Object.defineProperty(mockEvent.currentTarget, 'scrollLeft', { value: 0 });
      Object.defineProperty(mockEvent.currentTarget, 'scrollTop', { value: 0 });

      act(() => {
        result.current.handleCanvasMouseDown(mockEvent);
      });

      expect(result.current.isSelecting).toBe(true);
      expect(result.current.selectionBoxStart).not.toBeNull();
      expect(result.current.selectionBoxEnd).not.toBeNull();
    });

    it('should clear selection when starting selection box without modifiers', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      // Select an item first
      act(() => {
        result.current.handleItemClick('card1', false, false, false);
      });
      expect(result.current.selectedIds.size).toBe(1);

      const mockEvent = {
        target: document.createElement('div'),
        currentTarget: document.createElement('div'),
        button: 0,
        clientX: 500,
        clientY: 500,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      } as unknown as React.MouseEvent;

      Object.defineProperty(mockEvent.currentTarget, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
      });
      Object.defineProperty(mockEvent.currentTarget, 'scrollLeft', { value: 0 });
      Object.defineProperty(mockEvent.currentTarget, 'scrollTop', { value: 0 });

      act(() => {
        result.current.handleCanvasMouseDown(mockEvent);
      });

      // Selection should be cleared
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('handleItemMouseDown', () => {
    it('should track mouse down on item', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      act(() => {
        result.current.handleItemMouseDown('card1');
      });

      // The ref should be set (we can't directly test it, but we can verify
      // the hook doesn't throw and continues to work)
      expect(result.current.justFinishedDraggingRef.current).toBe(false);
    });
  });

  describe('setSelectedIds', () => {
    it('should allow manual selection updates', () => {
      const { result } = renderHook(() =>
        useSelection({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          zoom: 1,
        })
      );

      act(() => {
        result.current.setSelectedIds(new Set(['card1', 'card2']));
      });

      expect(result.current.selectedIds.size).toBe(2);
      expect(result.current.selectedIds.has('card1')).toBe(true);
      expect(result.current.selectedIds.has('card2')).toBe(true);
    });
  });
});

