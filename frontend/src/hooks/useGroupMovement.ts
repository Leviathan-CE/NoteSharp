import { useRef, useEffect } from 'react';

interface Item {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface LineItem {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

interface UseGroupMovementProps {
  items: Item[];
  lines: LineItem[];
  selectedIds: Set<string>;
  updateItem: (id: string, position: { x: number; y: number }) => void;
  updateLine: (id: string, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) => void;
}

interface UseGroupMovementReturn {
  handleItemPositionChange: (id: string, position: { x: number; y: number }, mousePosition?: { x: number; y: number }) => void;
  handleLinePointsChange: (
    id: string,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    mousePosition?: { x: number; y: number }
  ) => void;
  getLastFinalPositions: () => { itemPositions: Map<string, { x: number; y: number }>; linePositions: Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> } | null;
}

/**
 * Hook for managing group movement of selected items
 */
export function useGroupMovement({
  items,
  lines,
  selectedIds,
  updateItem,
  updateLine,
}: UseGroupMovementProps): UseGroupMovementReturn {
  // Store initial mouse position when drag starts
  const initialMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  // Store current mouse position (updated during drag)
  const currentMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  // Store initial positions of ALL selected items when drag starts
  const selectedItemsInitialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Store initial line start/end points for reconstruction
  const selectedLinesInitialPointsRef = useRef<Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }>>(new Map());
  // Ref to track latest selectedIds to avoid stale closures
  const selectedIdsRef = useRef<Set<string>>(selectedIds);
  // Track if we're currently dragging
  const isDraggingRef = useRef<boolean>(false);
  // Store final positions from finalizeGroupMovement for database saving
  const finalPositionsRef = useRef<{ itemPositions: Map<string, { x: number; y: number }>; linePositions: Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> } | null>(null);
  
  // Global mouse move listener to detect dragging and move all selected items
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Only proceed if we have multiple items selected
      if (selectedIdsRef.current.size <= 1) {
        return;
      }

      // Find which selected item is currently being dragged (has a transform)
      let activeDraggedId: string | null = null;
      let draggedDeltaX = 0;
      let draggedDeltaY = 0;

      // Check all selected items to find which one has a transform or is being dragged
      // We need to check the DraggableWrapper element (parent of data-card/board/image)
      // For lines, we check if they're being dragged via handleLinePointsChange calls
      for (const itemId of Array.from(selectedIdsRef.current)) {
        // Find the child element with the data attribute (including lines)
        const childElement = document.querySelector(`[data-card="${itemId}"], [data-board="${itemId}"], [data-image="${itemId}"], [data-line="${itemId}"]`) as HTMLElement;
        if (!childElement) continue;
        
        // For lines, check if they're currently being dragged (isDraggingLine state)
        // Lines don't use DraggableWrapper, so we can't detect them via transform
        // Instead, we rely on handleLinePointsChange being called with mousePosition during drag
        // If a line is being dragged, it will be detected via the handleLinePointsChange callback
        // For now, skip lines in the transform detection (they're handled separately)
        if (childElement.hasAttribute('data-line')) {
          continue; // Lines are handled via handleLinePointsChange, not transform detection
        }
        
        // Get the parent (DraggableWrapper) which has the transform
        // The DraggableWrapper is the immediate parent that has the transform style
        let element = childElement.parentElement as HTMLElement;
        
        // Walk up the tree to find the element with transform (might be nested)
        while (element && element !== document.body) {
          // Check if this element has a transform or is positioned absolutely (DraggableWrapper characteristics)
          const hasTransform = element.style.transform && element.style.transform.includes('translate');
          const isPositioned = element.style.position === 'absolute' || window.getComputedStyle(element).position === 'absolute';
          
          if (hasTransform) {
            // Found the element with transform
            const transform = element.style.transform;
            const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
            if (match) {
              const deltaX = parseFloat(match[1]);
              const deltaY = parseFloat(match[2]);
              
              // Only consider it dragging if the delta is non-zero (actually moving)
              if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
                activeDraggedId = itemId;
                draggedDeltaX = deltaX;
                draggedDeltaY = deltaY;
                break;
              }
            }
            break;
          }
          
          // If this looks like the DraggableWrapper (absolute positioned), check it even without transform
          if (isPositioned && element.classList.contains('absolute')) {
            // This is likely the DraggableWrapper - check its transform
            const transform = element.style.transform;
            if (transform && transform.includes('translate')) {
              const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
              if (match) {
                const deltaX = parseFloat(match[1]);
                const deltaY = parseFloat(match[2]);
                if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
                  activeDraggedId = itemId;
                  draggedDeltaX = deltaX;
                  draggedDeltaY = deltaY;
                  break;
                }
              }
            }
            break;
          }
          
          element = element.parentElement as HTMLElement;
        }
        
        if (activeDraggedId) break;
      }


      // If we found a dragged item, initialize drag state if needed and move all others
      if (activeDraggedId) {
        // Initialize drag state on first detection or if dragging a different item
        // Always re-initialize if not currently dragging or if dragging a different item
        const needsInitialization = !isGroupDraggingRef.current || draggedItemIdRef.current !== activeDraggedId;
        
        if (needsInitialization) {
          draggedItemIdRef.current = activeDraggedId;
          isGroupDraggingRef.current = true;
          
          // Get actual DOM positions for all selected items (not from state, which may be stale)
          const draggedChildElement = document.querySelector(`[data-card="${activeDraggedId}"], [data-board="${activeDraggedId}"], [data-image="${activeDraggedId}"]`) as HTMLElement;
          if (draggedChildElement) {
            // Walk up to find the DraggableWrapper
            let draggedElement = draggedChildElement.parentElement as HTMLElement;
            let draggedPosition = { x: 0, y: 0 };
            
            while (draggedElement && draggedElement !== document.body) {
              if (draggedElement.classList.contains('absolute')) {
                draggedPosition = {
                  x: parseFloat(draggedElement.style.left || '0'),
                  y: parseFloat(draggedElement.style.top || '0'),
                };
                // If there's a transform, we need to subtract it to get the base position
                const transform = draggedElement.style.transform;
                if (transform && transform.includes('translate')) {
                  const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                  if (match) {
                    draggedPosition.x -= parseFloat(match[1]);
                    draggedPosition.y -= parseFloat(match[2]);
                  }
                }
                break;
              }
              draggedElement = draggedElement.parentElement as HTMLElement;
            }
            
            // Initialize with actual DOM position (base position before transform)
            initializeDragState(activeDraggedId, draggedPosition, draggedPosition.x + draggedDeltaX, draggedPosition.y + draggedDeltaY);
            itemMovementDeltasRef.current.clear();
          }
        }

        // Store the dragged item's delta
        itemMovementDeltasRef.current.set(activeDraggedId, { x: draggedDeltaX, y: draggedDeltaY });

        // Apply the same delta to all other selected items (mirror the dragged item's transform)
        for (const itemId of Array.from(selectedIdsRef.current)) {
          if (itemId !== activeDraggedId) {
            const childElement = document.querySelector(`[data-card="${itemId}"], [data-board="${itemId}"], [data-image="${itemId}"]`) as HTMLElement;
            if (!childElement) continue;
            
            // Walk up to find the DraggableWrapper (absolute positioned div)
            let element = childElement.parentElement as HTMLElement;
            while (element && element !== document.body) {
              if (element.classList.contains('absolute') && window.getComputedStyle(element).position === 'absolute') {
                // Only update if this element doesn't already have the correct transform
                const currentTransform = element.style.transform;
                const expectedTransform = `translate(${draggedDeltaX}px, ${draggedDeltaY}px)`;
                
                if (currentTransform !== expectedTransform) {
                  element.style.transition = 'none';
                  element.style.transform = expectedTransform;
                  element.setAttribute('data-group-move', 'true');
                  
                  // Store delta for finalization
                  itemMovementDeltasRef.current.set(itemId, { x: draggedDeltaX, y: draggedDeltaY });
                }
                break;
              }
              element = element.parentElement as HTMLElement;
            }
          }
        }

        // Store line deltas during drag (don't update state yet)
        for (const lineId of Array.from(selectedIdsRef.current)) {
          const line = lines.find(l => l.id === lineId);
          if (line) {
            const initialPoints = selectedLinesInitialPointsRef.current.get(lineId);
            if (initialPoints) {
              // Store delta for finalization, don't call updateLine during drag
              itemMovementDeltasRef.current.set(lineId, { x: draggedDeltaX, y: draggedDeltaY });
            }
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      // Reset group dragging state on mouse up
      // Don't clear isGroupDraggingRef here - let handleItemPositionChange handle it
      // This ensures finalization happens first
    };

    // Always attach listener - check inside handler if we have multiple items
    // This ensures the listener is always available when needed
    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    document.addEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
    };
  }, [selectedIds, items, lines]);

  // Update ref whenever selectedIds changes
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    
    // Clear drag state when selection is cleared (canvas click deselects all)
    if (selectedIds.size === 0) {
      initialMousePositionRef.current = null;
      currentMousePositionRef.current = null;
      selectedItemsInitialPositionsRef.current.clear();
      selectedLinesInitialPointsRef.current.clear();
      itemMovementDeltasRef.current.clear();
      isDraggingRef.current = false;
      draggedItemIdRef.current = null;
      isGroupDraggingRef.current = false;
      
      // Reset any transforms that might still be applied
      items.forEach(item => {
        const element = document.querySelector(`[data-card="${item.id}"], [data-board="${item.id}"], [data-image="${item.id}"]`)?.parentElement as HTMLElement;
        if (element && element.hasAttribute('data-group-move')) {
          element.style.transform = 'translate(0, 0)';
          element.removeAttribute('data-group-move');
        }
      });
    }
  }, [selectedIds, items]);

  // Note: We don't need a global mouse tracker anymore since DraggableWrapper
  // always provides mouse positions in scene coordinates (scaled by zoom)

  // Helper function to initialize drag state - store initial positions (like DraggableWrapper's startPositionRef)
  const initializeDragState = (draggedId: string, draggedPosition: { x: number; y: number }, mouseX: number, mouseY: number) => {
    // Store initial and current mouse position
    initialMousePositionRef.current = { x: mouseX, y: mouseY };
    currentMousePositionRef.current = { x: mouseX, y: mouseY };
    isDraggingRef.current = true;
    
    // Clear previous initial positions
    selectedItemsInitialPositionsRef.current.clear();
    selectedLinesInitialPointsRef.current.clear();
    
    // Store initial positions for all selected items using actual DOM positions (like DraggableWrapper's startPositionRef)
    for (const itemId of Array.from(selectedIdsRef.current)) {
      const childElement = document.querySelector(`[data-card="${itemId}"], [data-board="${itemId}"], [data-image="${itemId}"]`) as HTMLElement;
      
      if (childElement) {
        // Walk up to find the DraggableWrapper
        let element = childElement.parentElement as HTMLElement;
        let domPosition = { x: 0, y: 0 };
        
        while (element && element !== document.body) {
          if (element.classList.contains('absolute') && window.getComputedStyle(element).position === 'absolute') {
            // Get base position (left/top) - this is like DraggableWrapper's startPositionRef
            domPosition = {
              x: parseFloat(element.style.left || '0'),
              y: parseFloat(element.style.top || '0'),
            };
            break;
          }
          element = element.parentElement as HTMLElement;
        }
        
        // For the dragged item, use the provided draggedPosition (base position before transform)
        // For others, use DOM position
        const initialPosition = itemId === draggedId ? draggedPosition : domPosition;
        selectedItemsInitialPositionsRef.current.set(itemId, { ...initialPosition });
      } else {
        // Fallback: try to find in items array
        const item = items.find(i => i.id === itemId);
        if (item) {
          const initialPosition = itemId === draggedId ? draggedPosition : item.position;
          selectedItemsInitialPositionsRef.current.set(itemId, { ...initialPosition });
        } else {
          // Check if it's a line
          const line = lines.find(l => l.id === itemId);
          if (line) {
            selectedLinesInitialPointsRef.current.set(itemId, {
              startPoint: { x: line.startPoint.x, y: line.startPoint.y },
              endPoint: { x: line.endPoint.x, y: line.endPoint.y },
            });
          }
        }
      }
    }
  };

  // Helper function to calculate new position for an item based on mouse movement delta
  const calculateItemPosition = (itemId: string, deltaX: number, deltaY: number): { x: number; y: number } | null => {
    const initialPosition = selectedItemsInitialPositionsRef.current.get(itemId);
    if (!initialPosition) return null;
    
    // New position = initial position + movement delta
    return {
      x: initialPosition.x + deltaX,
      y: initialPosition.y + deltaY,
    };
  };

  // Store accumulated movement deltas for each item (for transform-based movement)
  const itemMovementDeltasRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Track which item is currently being dragged
  const draggedItemIdRef = useRef<string | null>(null);
  // Track if we're in the middle of a group drag
  const isGroupDraggingRef = useRef<boolean>(false);

  // Helper function to update all selected items using transform (like DraggableWrapper)
  const updateAllSelectedItemsWithTransform = (totalDeltaX: number, totalDeltaY: number) => {
    // Update all selected items using transform: translate() for smooth movement
    items.forEach(item => {
      if (selectedIdsRef.current.has(item.id)) {
        // Find the draggable wrapper element (walk up to the absolute-positioned wrapper)
        const child = document.querySelector(`[data-card="${item.id}"], [data-board="${item.id}"], [data-image="${item.id}"]`) as HTMLElement;
        let element = child ? child.parentElement as HTMLElement : null;
        while (element && element !== document.body && !element.classList.contains('absolute')) {
          element = element.parentElement as HTMLElement;
        }

        if (element) {
          // Store the total delta for this item (will be used to calculate final position)
          itemMovementDeltasRef.current.set(item.id, { x: totalDeltaX, y: totalDeltaY });
          
          // Apply transform for smooth visual movement (no React re-render)
          element.style.transition = 'none';
          element.style.transform = `translate(${totalDeltaX}px, ${totalDeltaY}px)`;
          element.setAttribute('data-group-move', 'true');
        }
      }
    });
  };

  // Helper function to finalize positions on drag end (exactly like DraggableWrapper's handleDocumentMouseUp)
  // This function batches all updates into a single state update
  // Returns the final positions for all items so they can be saved to database
  const finalizeGroupMovement = (draggedId: string, draggedFinalPosition: { x: number; y: number }): {
    itemPositions: Map<string, { x: number; y: number }>;
    linePositions: Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }>;
  } => {
    console.log('[useGroupMovement] finalizeGroupMovement START', {
      draggedId,
      draggedFinalPosition,
      selectedCount: selectedIdsRef.current.size
    });
    
    // Collect all updates first
    const itemUpdates: Array<{ id: string; position: { x: number; y: number } }> = [];
    const lineUpdates: Array<{ id: string; startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> = [];
    
    // Maps to store final positions for database saving
    const itemPositions = new Map<string, { x: number; y: number }>();
    const linePositions = new Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }>();
    
    // Get the dragged item's initial position (like DraggableWrapper's startPositionRef)
    const draggedInitialPosition = selectedItemsInitialPositionsRef.current.get(draggedId);
    
    // Calculate the total movement delta from the dragged item's final position
    // This is like: finalPosition = startPositionRef.current + endPos.current
    let totalDeltaX = 0;
    let totalDeltaY = 0;
    if (draggedInitialPosition) {
      totalDeltaX = draggedFinalPosition.x - draggedInitialPosition.x;
      totalDeltaY = draggedFinalPosition.y - draggedInitialPosition.y;
    } else {
      // Fallback: use stored movement delta
      const movementDelta = itemMovementDeltasRef.current.get(draggedId) || { x: 0, y: 0 };
      totalDeltaX = movementDelta.x;
      totalDeltaY = movementDelta.y;
    }
    
    console.log('[useGroupMovement] finalizeGroupMovement delta', {
      totalDeltaX,
      totalDeltaY,
      draggedInitialPosition
    });
    
    // Calculate final positions for all items using the same delta (mirror the dragged item's movement)
    items.forEach(item => {
      if (selectedIdsRef.current.has(item.id)) {
        const childElement = document.querySelector(`[data-card="${item.id}"], [data-board="${item.id}"], [data-image="${item.id}"]`) as HTMLElement;
        if (!childElement) return;
        
        const initialPosition = selectedItemsInitialPositionsRef.current.get(item.id);
        if (!initialPosition) {
          console.log('[useGroupMovement] No initial position for', item.id);
          return;
        }
        
        // Calculate final position: initial + same delta as dragged item (like DraggableWrapper)
        const finalPosition = {
          x: initialPosition.x + totalDeltaX,
          y: initialPosition.y + totalDeltaY,
        };
        
        console.log('[useGroupMovement] Finalizing item', item.id, {
          initial: initialPosition,
          final: finalPosition
        });
        
        // Walk up to find the DraggableWrapper
        let element = childElement.parentElement as HTMLElement;
        while (element && element !== document.body) {
          if (element.classList.contains('absolute') && window.getComputedStyle(element).position === 'absolute') {
            // Update React state FIRST (like DraggableWrapper's setPosition)
            // This will be done via updateItem below
            
            // Then update DOM directly to ensure it stays in place (like DraggableWrapper)
            element.style.transform = 'translate(0, 0)';
            element.style.transition = 'none'; // Disable transition temporarily
            element.style.left = `${finalPosition.x}px`;
            element.style.top = `${finalPosition.y}px`;
            element.removeAttribute('data-group-move');
            
            // Re-enable transition after a brief moment (like DraggableWrapper)
            setTimeout(() => {
              if (element) {
                element.style.transition = '';
              }
            }, 0);
            
            break;
          }
          element = element.parentElement as HTMLElement;
        }
        
        // Collect update (don't call updateItem yet - batch all updates)
        itemUpdates.push({ id: item.id, position: finalPosition });
        // Store final position for database saving
        itemPositions.set(item.id, finalPosition);
      }
    });
    
    // Calculate final positions for all lines using the same delta
    lines.forEach(line => {
      if (selectedIdsRef.current.has(line.id)) {
        const initialPoints = selectedLinesInitialPointsRef.current.get(line.id);
        
        if (initialPoints) {
          const finalStartPoint = {
            x: initialPoints.startPoint.x + totalDeltaX,
            y: initialPoints.startPoint.y + totalDeltaY,
          };
          const finalEndPoint = {
            x: initialPoints.endPoint.x + totalDeltaX,
            y: initialPoints.endPoint.y + totalDeltaY,
          };
          
          // Collect update (don't call updateLine yet)
          lineUpdates.push({
            id: line.id,
            startPoint: finalStartPoint,
            endPoint: finalEndPoint,
          });
          
          // Store final position for database saving
          linePositions.set(line.id, { startPoint: finalStartPoint, endPoint: finalEndPoint });
        }
      }
    });
    
    // Batch all updates: update all items first, then all lines
    // This ensures only one state update cycle happens
    itemUpdates.forEach(update => {
      updateItem(update.id, update.position);
    });
    
    lineUpdates.forEach(update => {
      updateLine(update.id, update.startPoint, update.endPoint);
    });
    
    // Clear movement deltas
    itemMovementDeltasRef.current.clear();
    
    // Return final positions for database saving
    return { itemPositions, linePositions };
  };

  const handleItemPositionChange = (id: string, position: { x: number; y: number }, mousePosition?: { x: number; y: number }) => {
    console.log('[useGroupMovement] handleItemPositionChange', {
      id,
      position,
      mousePosition,
      selectedCount: selectedIdsRef.current.size,
      isSelected: selectedIdsRef.current.has(id),
      isGroupDragging: isGroupDraggingRef.current
    });
    
    // If mousePosition is undefined, drag has ended - finalize positions
    if (mousePosition === undefined) {
      console.log('[useGroupMovement] Drag ENDED for', id, {
        selectedCount: selectedIdsRef.current.size,
        isSelected: selectedIdsRef.current.has(id)
      });
      
      // Drag ended - finalize all positions in a single batched update
      if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id)) {
        console.log('[useGroupMovement] Finalizing GROUP movement');
        // Finalize all selected items (including the dragged one) in one batch
        // Pass the dragged item's final position from DraggableWrapper
        const finalPositions = finalizeGroupMovement(id, position);
        // Store final positions in a ref so rootBoard can access them
        finalPositionsRef.current = finalPositions;
      } else {
        console.log('[useGroupMovement] Finalizing SINGLE item movement');
        // Single item drag - just update this item
        updateItem(id, position);
      }
      
      // Clear drag tracking and reset state for next drag
      draggedItemIdRef.current = null;
      isGroupDraggingRef.current = false;
      initialMousePositionRef.current = null;
      currentMousePositionRef.current = null;
      itemMovementDeltasRef.current.clear();
      // Clear initial positions so they get recalculated on next drag
      selectedItemsInitialPositionsRef.current.clear();
      selectedLinesInitialPointsRef.current.clear();
      console.log('[useGroupMovement] Cleared all drag state');
      return;
    }

    // During drag (mousePosition is provided) - but DraggableWrapper doesn't call this during drag
    // This is only called if something else triggers it, so we'll handle it via global mousemove instead
    // But we still need to track which item is being dragged
    if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id)) {
      // Mark this as the dragged item and start group dragging
      if (!isGroupDraggingRef.current) {
        draggedItemIdRef.current = id;
        isGroupDraggingRef.current = true;
        // Initialize drag state on first call
        initializeDragState(id, position, mousePosition.x, mousePosition.y);
        itemMovementDeltasRef.current.clear();
      }
    }
  };

  const handleLinePointsChange = (
    id: string,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    mousePosition?: { x: number; y: number }
  ) => {
    // If mousePosition is undefined, drag has ended - finalize positions
    if (mousePosition === undefined) {
      // Drag ended - finalize all positions in a single batched update
      if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id)) {
        // Finalize all selected items (including the dragged line) in one batch
        // For lines, use the center point as the position
        const centerPoint = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2,
        };
        const finalPositions = finalizeGroupMovement(id, centerPoint);
        // Store final positions in a ref so rootBoard can access them
        finalPositionsRef.current = finalPositions;
      } else {
        // Single line drag - just update this line
        updateLine(id, startPoint, endPoint);
      }
      
      // Clear drag tracking and reset state for next drag
      draggedItemIdRef.current = null;
      isGroupDraggingRef.current = false;
      initialMousePositionRef.current = null;
      currentMousePositionRef.current = null;
      itemMovementDeltasRef.current.clear();
      // Clear initial positions so they get recalculated on next drag
      selectedItemsInitialPositionsRef.current.clear();
      selectedLinesInitialPointsRef.current.clear();
      return;
    }

    // During drag (mousePosition is provided)
    // If this is the first position change, initialize drag state
    if (!initialMousePositionRef.current || !selectedLinesInitialPointsRef.current.has(id)) {
      const line = lines.find(l => l.id === id);
      if (line) {
        // Calculate center point for the dragged line
        const initialCenterX = (startPoint.x + endPoint.x) / 2;
        const initialCenterY = (startPoint.y + endPoint.y) / 2;
        initializeDragState(id, { x: initialCenterX, y: initialCenterY }, mousePosition.x, mousePosition.y);
        itemMovementDeltasRef.current.clear();
      }
    }

    // Update current mouse position
    currentMousePositionRef.current = mousePosition;

    // Calculate movement delta
    if (!initialMousePositionRef.current || !currentMousePositionRef.current) {
      return;
    }

    const totalDeltaX = currentMousePositionRef.current.x - initialMousePositionRef.current.x;
    const totalDeltaY = currentMousePositionRef.current.y - initialMousePositionRef.current.y;

    // Store the dragged line's delta (don't update state during drag)
    itemMovementDeltasRef.current.set(id, { x: totalDeltaX, y: totalDeltaY });

    // If multiple items are selected, move all of them visually
    if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id)) {
      // Update all selected items using transform with total delta
      updateAllSelectedItemsWithTransform(totalDeltaX, totalDeltaY);
      
      // Move all other selected lines during drag (update their state so they move visually)
      lines.forEach(line => {
        if (line.id !== id && selectedIdsRef.current.has(line.id)) {
          const initialPoints = selectedLinesInitialPointsRef.current.get(line.id);
          if (initialPoints) {
            // Calculate new positions for this line
            const newStartPoint = {
              x: initialPoints.startPoint.x + totalDeltaX,
              y: initialPoints.startPoint.y + totalDeltaY,
            };
            const newEndPoint = {
              x: initialPoints.endPoint.x + totalDeltaX,
              y: initialPoints.endPoint.y + totalDeltaY,
            };
            
            // Update the line's state during drag so it moves visually
            updateLine(line.id, newStartPoint, newEndPoint);
            
            // Store delta for finalization
            itemMovementDeltasRef.current.set(line.id, { x: totalDeltaX, y: totalDeltaY });
          }
        }
      });
    }
  };


  const getLastFinalPositions = () => {
    return finalPositionsRef.current;
  };

  return {
    handleItemPositionChange,
    handleLinePointsChange,
    getLastFinalPositions,
  };
}

