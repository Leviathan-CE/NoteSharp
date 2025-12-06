/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroupMovement } from '../../src/hooks/useGroupMovement';
import { CardData, BoardData, LineData } from '../../src/types/boardTypes';

describe('useGroupMovement Hook', () => {
  const mockCards: CardData[] = [
    { id: 'card1', position: { x: 100, y: 100 }, size: { width: 200, height: 150 }, content: 'Card 1' },
    { id: 'card2', position: { x: 300, y: 200 }, size: { width: 200, height: 150 }, content: 'Card 2' },
  ];

  const mockBoards: BoardData[] = [
    { id: 'board1', position: { x: 500, y: 300 }, title: 'Board 1', cardCount: 0 },
  ];

  const mockLines: LineData[] = [
    { id: 'line1', startPoint: { x: 50, y: 50 }, endPoint: { x: 150, y: 150 } },
  ];

  const mockSetCards = vi.fn();
  const mockSetBoards = vi.fn();
  const mockSetLines = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetCards.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        return updater(mockCards);
      }
      return updater;
    });
    mockSetBoards.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        return updater(mockBoards);
      }
      return updater;
    });
    mockSetLines.mockImplementation((updater) => {
      if (typeof updater === 'function') {
        return updater(mockLines);
      }
      return updater;
    });
  });

  describe('single item movement', () => {
    it('should update single card position', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['card1']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      act(() => {
        result.current.handleCardPositionChange('card1', { x: 150, y: 150 });
      });

      expect(mockSetCards).toHaveBeenCalled();
      const updateCall = mockSetCards.mock.calls[0][0];
      const updatedCards = updateCall(mockCards);
      expect(updatedCards.find(c => c.id === 'card1')?.position).toEqual({ x: 150, y: 150 });
    });

    it('should update single board position', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['board1']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      act(() => {
        result.current.handleBoardPositionChange('board1', { x: 600, y: 400 });
      });

      expect(mockSetBoards).toHaveBeenCalled();
      const updateCall = mockSetBoards.mock.calls[0][0];
      const updatedBoards = updateCall(mockBoards);
      expect(updatedBoards.find(b => b.id === 'board1')?.position).toEqual({ x: 600, y: 400 });
    });
  });

  describe('group movement', () => {
    it('should move all selected cards together', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['card1', 'card2']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      // Move card1 by 50px in both directions
      act(() => {
        result.current.handleCardPositionChange('card1', { x: 150, y: 150 });
      });

      expect(mockSetCards).toHaveBeenCalled();
      const updateCall = mockSetCards.mock.calls[0][0];
      const updatedCards = updateCall(mockCards);
      
      // card1 should be at new position
      expect(updatedCards.find(c => c.id === 'card1')?.position).toEqual({ x: 150, y: 150 });
      // card2 should also move by the same delta (50, 50)
      expect(updatedCards.find(c => c.id === 'card2')?.position).toEqual({ x: 350, y: 250 });
    });

    it('should move selected boards when a card is dragged', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['card1', 'board1']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      // Move card1 by 50px
      act(() => {
        result.current.handleCardPositionChange('card1', { x: 150, y: 150 });
      });

      expect(mockSetBoards).toHaveBeenCalled();
      const updateCall = mockSetBoards.mock.calls[0][0];
      const updatedBoards = updateCall(mockBoards);
      
      // board1 should also move by the same delta
      expect(updatedBoards.find(b => b.id === 'board1')?.position).toEqual({ x: 550, y: 350 });
    });

    it('should calculate delta from initial position, not current', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['card1', 'card2']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      // First move
      act(() => {
        result.current.handleCardPositionChange('card1', { x: 150, y: 150 });
      });

      // Second move - should still calculate from original position (100, 100)
      act(() => {
        result.current.handleCardPositionChange('card1', { x: 200, y: 200 });
      });

      expect(mockSetCards).toHaveBeenCalledTimes(2);
      const secondUpdateCall = mockSetCards.mock.calls[1][0];
      const updatedCards = secondUpdateCall(mockCards);
      
      // card1 should be at 200, 200 (delta of 100, 100 from original 100, 100)
      expect(updatedCards.find(c => c.id === 'card1')?.position).toEqual({ x: 200, y: 200 });
      // card2 should also move by delta of 100, 100 from its original position
      expect(updatedCards.find(c => c.id === 'card2')?.position).toEqual({ x: 400, y: 300 });
    });
  });

  describe('line movement', () => {
    it('should move line when dragged', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['line1']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      act(() => {
        result.current.handleLinePointsChange(
          'line1',
          { x: 100, y: 100 },
          { x: 200, y: 200 }
        );
      });

      expect(mockSetLines).toHaveBeenCalled();
      const updateCall = mockSetLines.mock.calls[0][0];
      const updatedLines = updateCall(mockLines);
      expect(updatedLines.find(l => l.id === 'line1')?.startPoint).toEqual({ x: 100, y: 100 });
      expect(updatedLines.find(l => l.id === 'line1')?.endPoint).toEqual({ x: 200, y: 200 });
    });

    it('should move selected items when a line is dragged', () => {
      const { result } = renderHook(() =>
        useGroupMovement({
          noteCards: mockCards,
          boards: mockBoards,
          lines: mockLines,
          selectedIds: new Set(['line1', 'card1']),
          setCards: mockSetCards,
          setBoards: mockSetBoards,
          setLines: mockSetLines,
        })
      );

      // Move line center from (100, 100) to (150, 150) - delta of (50, 50)
      act(() => {
        result.current.handleLinePointsChange(
          'line1',
          { x: 125, y: 125 },
          { x: 175, y: 175 }
        );
      });

      expect(mockSetCards).toHaveBeenCalled();
      const updateCall = mockSetCards.mock.calls[0][0];
      const updatedCards = updateCall(mockCards);
      
      // card1 should move by the same delta
      expect(updatedCards.find(c => c.id === 'card1')?.position).toEqual({ x: 150, y: 150 });
    });
  });
});

