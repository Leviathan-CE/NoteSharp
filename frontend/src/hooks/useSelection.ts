import { useState, useCallback, useRef, useEffect } from 'react';
import { CardData, BoardData, LineData } from '../types/boardTypes';

type RefType<T> = { current: T };

interface ImageData {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
}

interface UseSelectionProps {
  noteCards: CardData[];
  boards: BoardData[];
  lines: LineData[];
  images?: ImageData[];
  zoom: number;
}

interface UseSelectionReturn {
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionBoxStart: { x: number; y: number } | null;
  selectionBoxEnd: { x: number; y: number } | null;
  isSelecting: boolean;
  handleCanvasMouseDown: (e: React.MouseEvent) => void;
  handleCanvasMouseMove: (e: React.MouseEvent) => void;
  handleCanvasMouseUp: () => void;
  handleItemClick: (id: string, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean) => void;
  justFinishedSelectingRef: RefType<boolean>;
  justFinishedDraggingRef: RefType<boolean>;
  handleItemMouseDown: (id: string) => void;
}

/**
 * Hook for managing selection box and multi-select functionality
 */
export function useSelection({
  noteCards,
  boards,
  lines,
  images = [],
  zoom,
}: UseSelectionProps): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionBoxStart, setSelectionBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBoxEnd, setSelectionBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const justFinishedSelectingRef = useRef(false);
  const justFinishedDraggingRef = useRef(false);
  const dragStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  // Keep a ref to the latest selectedIds to avoid stale closures
  const selectedIdsRef = useRef(selectedIds);
  
  // Update the ref whenever selectedIds changes
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Constants
  const CONTAINER_PADDING = 0; // p-24 = 24 * 4 = 96px
  const OFFSET_X = 0;
  const OFFSET_Y = 0;

  // Helper to convert mouse position to scene coordinates
  const mouseToSceneCoordinates = useCallback((clientX: number, clientY: number, canvas: HTMLElement): { x: number; y: number } => {
    // Find the scaled container inside the canvas
    const scaledContainer = canvas.querySelector('.absolute.inset-0.p-24') as HTMLElement;
    if (!scaledContainer) {
      // Fallback calculation if container not found
      const canvasRect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft;
      const scrollTop = canvas.scrollTop;
      const x = (clientX - canvasRect.left + scrollLeft - CONTAINER_PADDING) / zoom;
      const y = (clientY - canvasRect.top + scrollTop - CONTAINER_PADDING) / zoom;
      return { x: x + OFFSET_X, y: y + OFFSET_Y };
    }
    
    // Get the container's bounding rect - this gives us its position in the viewport
    const containerRect = scaledContainer.getBoundingClientRect();
    
    // Mouse position relative to container's top-left corner (in viewport space)
    const relativeX = clientX - containerRect.left;
    const relativeY = clientY - containerRect.top;
    
    // Subtract padding to get position relative to container's content area
    // Then divide by zoom to convert to unzoomed space (since container applies zoom transform)
    const x = (relativeX - CONTAINER_PADDING) / zoom + OFFSET_X;
    const y = (relativeY - CONTAINER_PADDING) / zoom + OFFSET_Y;
    
    return { x, y };
  }, [zoom]);

  // Helper to check if an item intersects with selection box
  const itemIntersectsSelectionBox = useCallback((
    itemPosition: { x: number; y: number },
    itemSize: { width: number; height: number },
    boxStart: { x: number; y: number },
    boxEnd: { x: number; y: number }
  ): boolean => {
    const boxLeft = Math.min(boxStart.x, boxEnd.x);
    const boxRight = Math.max(boxStart.x, boxEnd.x);
    const boxTop = Math.min(boxStart.y, boxEnd.y);
    const boxBottom = Math.max(boxStart.y, boxEnd.y);
    
    const itemLeft = itemPosition.x;
    const itemRight = itemPosition.x + itemSize.width;
    const itemTop = itemPosition.y;
    const itemBottom = itemPosition.y + itemSize.height;
    
    // Check if item intersects with selection box
    return !(itemRight < boxLeft || itemLeft > boxRight || itemBottom < boxTop || itemTop > boxBottom);
  }, []);

  // Helper to find items that intersect with the selection box
  const findItemsInSelectionBox = useCallback((
    boxStart: { x: number; y: number },
    boxEnd: { x: number; y: number }
  ): Set<string> => {
    const newSelectedIds = new Set<string>();
    
    // Check cards
    noteCards.forEach(card => {
      if (itemIntersectsSelectionBox(
        card.position,
        card.size,
        boxStart,
        boxEnd
      )) {
        newSelectedIds.add(card.id);
      }
    });
    
    // Check boards (approximate size as 200x200)
    boards.forEach(board => {
      if (itemIntersectsSelectionBox(
        board.position,
        { width: 200, height: 200 },
        boxStart,
        boxEnd
      )) {
        newSelectedIds.add(board.id);
      }
    });
    
    // Check images
    images.forEach(image => {
      if (itemIntersectsSelectionBox(
        image.position,
        image.size,
        boxStart,
        boxEnd
      )) {
        newSelectedIds.add(image.id);
      }
    });
    
    // Check lines (approximate as a bounding box)
    lines.forEach(line => {
      const lineLeft = Math.min(line.startPoint.x, line.endPoint.x);
      const lineRight = Math.max(line.startPoint.x, line.endPoint.x);
      const lineTop = Math.min(line.startPoint.y, line.endPoint.y);
      const lineBottom = Math.max(line.startPoint.y, line.endPoint.y);
      
      if (itemIntersectsSelectionBox(
        { x: lineLeft, y: lineTop },
        { width: Math.max(1, lineRight - lineLeft), height: Math.max(1, lineBottom - lineTop) },
        boxStart,
        boxEnd
      )) {
        newSelectedIds.add(line.id);
      }
    });
    
    return newSelectedIds;
  }, [noteCards, boards, lines, images, itemIntersectsSelectionBox]);

  // Handle selection box mouse events
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickingOnItem = target.closest('[data-card]') || 
                            target.closest('[data-board]') || 
                            target.closest('[data-line]') ||
                            target.closest('[data-image]');
    
    // Don't start selection box if we're currently dragging an item
    if (dragStartRef.current && hasMovedRef.current) {
      return;
    }
    
    // Only start selection box if clicking on canvas background (not on an item)
    if (!isClickingOnItem && e.button === 0) { // Left mouse button
      const canvas = e.currentTarget as HTMLElement;
      const scenePos = mouseToSceneCoordinates(e.clientX, e.clientY, canvas);
      
      setSelectionBoxStart(scenePos);
      setSelectionBoxEnd(scenePos);
      selectionBoxEndRef.current = scenePos;
      setIsSelecting(true);
      selectionBoxElementRef.current = null; // Reset ref to find element on next move
      
      // Clear selection if not holding Ctrl/Shift
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setSelectedIds(new Set());
      }
    }
  }, [mouseToSceneCoordinates]);

  // Use refs to track selection box position for direct DOM updates
  const selectionBoxEndRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxElementRef = useRef<HTMLElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 50; // Update React state at most every 50ms

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    // Don't update selection box if we're currently dragging an item
    if (dragStartRef.current && hasMovedRef.current) {
      // Cancel selection box if dragging started
      if (isSelecting) {
        setIsSelecting(false);
        setSelectionBoxStart(null);
        setSelectionBoxEnd(null);
        selectionBoxEndRef.current = null;
      }
      return;
    }
    
    if (!isSelecting || !selectionBoxStart) return;
    
    const canvas = e.currentTarget as HTMLElement;
    const scenePos = mouseToSceneCoordinates(e.clientX, e.clientY, canvas);
    
    // Store in ref for immediate DOM updates
    selectionBoxEndRef.current = scenePos;
    
    // Update DOM directly for smooth visual updates (no re-render)
    if (!selectionBoxElementRef.current) {
      // Find the selection box element
      selectionBoxElementRef.current = canvas.querySelector('[data-selection-box]') as HTMLElement;
    }
    
    if (selectionBoxElementRef.current && selectionBoxStart) {
      const left = Math.min(selectionBoxStart.x, scenePos.x);
      const top = Math.min(selectionBoxStart.y, scenePos.y);
      const width = Math.abs(scenePos.x - selectionBoxStart.x);
      const height = Math.abs(scenePos.y - selectionBoxStart.y);
      
      // Direct DOM manipulation for performance
      selectionBoxElementRef.current.style.left = `${left}px`;
      selectionBoxElementRef.current.style.top = `${top}px`;
      selectionBoxElementRef.current.style.width = `${width}px`;
      selectionBoxElementRef.current.style.height = `${height}px`;
    }
    
    // Throttle React state updates to avoid excessive re-renders
    const now = Date.now();
    if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE_MS) {
      // Cancel any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      
      // Update React state (triggers re-render for selection calculation)
      setSelectionBoxEnd(scenePos);
      
      // Update selection based on items in box
      const newSelectedIds = findItemsInSelectionBox(selectionBoxStart, scenePos);
      setSelectedIds(newSelectedIds);
      
      lastUpdateTimeRef.current = now;
    } else {
      // Schedule update via requestAnimationFrame if not throttled
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (selectionBoxStart && selectionBoxEndRef.current) {
            setSelectionBoxEnd(selectionBoxEndRef.current);
            const newSelectedIds = findItemsInSelectionBox(selectionBoxStart, selectionBoxEndRef.current);
            setSelectedIds(newSelectedIds);
            lastUpdateTimeRef.current = Date.now();
          }
          rafIdRef.current = null;
        });
      }
    }
  }, [isSelecting, selectionBoxStart, mouseToSceneCoordinates, findItemsInSelectionBox]);

  const handleCanvasMouseUp = useCallback(() => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // If we were selecting, do a final check for items in the selection box
    const finalEnd = selectionBoxEndRef.current || selectionBoxEnd;
    if (isSelecting && selectionBoxStart && finalEnd) {
      // Final check for items in selection box
      const newSelectedIds = findItemsInSelectionBox(selectionBoxStart, finalEnd);
      setSelectedIds(newSelectedIds);
      
      // Mark that we just finished selecting so click doesn't clear selection
      justFinishedSelectingRef.current = true;
      // Clear the flag after a short delay to allow click event to check it
      setTimeout(() => {
        justFinishedSelectingRef.current = false;
      }, 100);
    }
    
    setIsSelecting(false);
    setSelectionBoxStart(null);
    setSelectionBoxEnd(null);
    selectionBoxEndRef.current = null;
    selectionBoxElementRef.current = null;
    lastUpdateTimeRef.current = 0;
  }, [isSelecting, selectionBoxStart, selectionBoxEnd, findItemsInSelectionBox]);

  // Handle item click with multi-select support
  const handleItemClick = useCallback((
    id: string,
    ctrlKey: boolean,
    shiftKey: boolean,
    metaKey: boolean
  ) => {
    console.log('[useSelection] handleItemClick', {
      id,
      justFinishedDragging: justFinishedDraggingRef.current,
      ctrlKey,
      shiftKey,
      metaKey
    });
    
    // Don't handle clicks if we just finished dragging - preserve the selection
    if (justFinishedDraggingRef.current) {
      console.log('[useSelection] handleItemClick BLOCKED - just finished dragging');
      return;
    }
    
    const isCtrlOrCmd = ctrlKey || metaKey;
    
    if (isCtrlOrCmd || shiftKey) {
      // Toggle selection (add if not selected, remove if selected)
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        console.log('[useSelection] Toggled selection, new set:', Array.from(newSet));
        return newSet;
      });
    } else {
      // Single select
      console.log('[useSelection] Single select:', id);
      setSelectedIds(new Set([id]));
    }
  }, []);

  // Track when mousedown happens on an item (to detect dragging)
  const handleItemMouseDown = useCallback((id: string) => {
    console.log('[useSelection] handleItemMouseDown', { id });
    // Track mousedown on any item - we'll check if it's selected when mouseup happens
    dragStartRef.current = { id, x: 0, y: 0 };
    hasMovedRef.current = false;
    console.log('[useSelection] Set dragStartRef', dragStartRef.current);
  }, []);

  // Track drag operations to prevent selection clearing after drag
  // This effect listens for global mouse events to detect dragging
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // If we're tracking a drag start, check if mouse has moved significantly
      if (dragStartRef.current) {
        // Initialize start position on first move
        if (startX === 0 && startY === 0) {
          startX = e.clientX;
          startY = e.clientY;
          console.log('[useSelection] handleGlobalMouseMove - initialized start position', { startX, startY });
        }
        
        // Calculate distance from start
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If mouse moved more than 5px, consider it a drag
        if (distance > 5 && !hasMovedRef.current) {
          hasMovedRef.current = true;
          // Set flag immediately when drag is detected to prevent click from clearing selection
          // This should be set for ALL drags, not just selected items
          justFinishedDraggingRef.current = true;
          console.log('[useSelection] handleGlobalMouseMove - DRAG DETECTED', {
            distance,
            draggedId: dragStartRef.current.id,
            justFinishedDraggingSet: true
          });
        }
      }
    };

    const handleGlobalMouseUp = (e?: MouseEvent) => {
      console.log('[useSelection] handleGlobalMouseUp', {
        hasDragStart: !!dragStartRef.current,
        hasMoved: hasMovedRef.current,
        draggedId: dragStartRef.current?.id,
        justFinishedDraggingBefore: justFinishedDraggingRef.current
      });
      
      // If we were tracking a drag and the mouse moved, it was a drag
      if (dragStartRef.current && hasMovedRef.current) {
        const draggedId = dragStartRef.current.id;
        // Set the flag IMMEDIATELY and SYNCHRONOUSLY to prevent click events from firing
        // This prevents selection clearing when dragging selected items
        justFinishedDraggingRef.current = true;
        console.log('[useSelection] Set justFinishedDraggingRef = true for drag of', draggedId);
        
        // Clear the flag after a longer delay to ensure click events don't clear selection
        // Use requestAnimationFrame to ensure this happens after any click events
        requestAnimationFrame(() => {
          setTimeout(() => {
            console.log('[useSelection] Clearing justFinishedDraggingRef after timeout');
            justFinishedDraggingRef.current = false;
          }, 300);
        });
      } else if (dragStartRef.current && !hasMovedRef.current) {
        // If we didn't move, it was just a click - clear the flag
        console.log('[useSelection] No movement detected, clearing justFinishedDraggingRef');
        justFinishedDraggingRef.current = false;
      }
      
      // Reset drag tracking
      dragStartRef.current = null;
      hasMovedRef.current = false;
      startX = 0;
      startY = 0;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    window.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    };
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    selectionBoxStart,
    selectionBoxEnd,
    isSelecting,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleItemClick,
    justFinishedSelectingRef,
    justFinishedDraggingRef,
    handleItemMouseDown,
  };
}

