import React, { useState, useRef, useEffect } from 'react';

interface LineToolProps {
  /** Unique identifier for this line */
  id: string;
  /** Initial start point on the canvas */
  initialStartPoint?: { x: number; y: number };
  /** Initial end point on the canvas */
  initialEndPoint?: { x: number; y: number };
  /** Callback when line points change */
  onPointsChange?: (id: string, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }, mousePosition?: { x: number; y: number }) => void;
  /** Callback when line is deleted */
  onDelete?: (id: string) => void;
  /** Callback when line is clicked (for selection) */
  onClick?: () => void;
  /** Whether the line is currently selected */
  isSelected?: boolean;
  /** Line color */
  color?: string;
  /** Line stroke width */
  strokeWidth?: number;
  /** Callback when mouse down occurs on the line */
  onMouseDown?: (id: string) => void;
}

/**
 * LineTool Component
 * 
 * A draggable line tool that allows users to place and position lines on the canvas.
 * Similar to NoteCard but for drawing lines with two draggable endpoints.
 * 
 * @example
 * ```tsx
 * <LineTool
 *   id="line-1"
 *   initialStartPoint={{ x: 100, y: 100 }}
 *   initialEndPoint={{ x: 300, y: 200 }}
 *   onPointsChange={(id, start, end) => console.log('Line moved:', start, end)}
 *   onClick={() => setSelectedId('line-1')}
 *   isSelected={selectedId === 'line-1'}
 * />
 * ```
 */
export function LineTool({
  id,
  initialStartPoint = { x: 100, y: 100 },
  initialEndPoint = { x: 300, y: 200 },
  onPointsChange,
  onDelete,
  onClick,
  isSelected = false,
  color = '#3b82f6', // Default blue color
  onMouseDown: onMouseDownCallback,
  strokeWidth = 2,
}: LineToolProps): React.ReactElement {
  const [startPoint, setStartPoint] = useState(initialStartPoint);
  const [endPoint, setEndPoint] = useState(initialEndPoint);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingLine, setIsDraggingLine] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [lineDragOffset, setLineDragOffset] = useState({ x: 0, y: 0 });
  const [containerPosition, setContainerPosition] = useState({ x: 0, y: 0 });
  const lineRef = useRef<SVGLineElement>(null);
  const currentPointsRef = useRef({ start: initialStartPoint, end: initialEndPoint });

  // Update points when initial values change externally
  useEffect(() => {
    setStartPoint(initialStartPoint);
    setEndPoint(initialEndPoint);
    currentPointsRef.current = { start: initialStartPoint, end: initialEndPoint };
    // Recalculate container position when initial values change
    const minX = Math.min(initialStartPoint.x, initialEndPoint.x);
    const minY = Math.min(initialStartPoint.y, initialEndPoint.y);
    setContainerPosition({ x: minX, y: minY });
  }, [initialStartPoint.x, initialStartPoint.y, initialEndPoint.x, initialEndPoint.y]);

  // Calculate bounding box for the line (for selection and positioning)
  const minX = Math.min(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const maxX = Math.max(startPoint.x, endPoint.x);
  const maxY = Math.max(startPoint.y, endPoint.y);
  const width = Math.max(maxX - minX, 1); // Ensure minimum width of 1
  const height = Math.max(maxY - minY, 1); // Ensure minimum height of 1

  const handleEndpointMouseDown = (e: React.MouseEvent, isStart: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isStart) {
      setIsDraggingStart(true);
      setDragOffset({
        x: e.clientX - startPoint.x,
        y: e.clientY - startPoint.y,
      });
    } else {
      setIsDraggingEnd(true);
      setDragOffset({
        x: e.clientX - endPoint.x,
        y: e.clientY - endPoint.y,
      });
    }
  };

  const handleLineMouseDown = (e: React.MouseEvent) => {
    // Only start dragging the line if not clicking on an endpoint
    const target = e.target as HTMLElement;
    if (target.tagName === 'circle') {
      return; // Let endpoint handle it
    }
    
    // Call the optional onMouseDown callback
    if (onMouseDownCallback) {
      onMouseDownCallback(id);
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate the offset from the midpoint of the line
    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;
    
    setIsDraggingLine(true);
    setLineDragOffset({
      x: e.clientX - midX,
      y: e.clientY - midY,
    });
  };

  // Handle endpoint dragging
  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPoint = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      };

      if (isDraggingStart) {
        setStartPoint(newPoint);
        currentPointsRef.current.start = newPoint;
      } else if (isDraggingEnd) {
        setEndPoint(newPoint);
        currentPointsRef.current.end = newPoint;
      }
      
      // Call onPointsChange during drag with mousePosition for group movement
      if (onPointsChange) {
        onPointsChange(id, currentPointsRef.current.start, currentPointsRef.current.end, { x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      
      // Use the ref values which are always up to date
      const finalStart = currentPointsRef.current.start;
      const finalEnd = currentPointsRef.current.end;
      
      // Update container position after drag completes
      const currentMinX = Math.min(finalStart.x, finalEnd.x);
      const currentMinY = Math.min(finalStart.y, finalEnd.y);
      setContainerPosition({ x: currentMinX, y: currentMinY });
      
      // Call onPointsChange with undefined mousePosition to signal drag end
      if (onPointsChange) {
        onPointsChange(id, finalStart, finalEnd, undefined);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, dragOffset, id, onPointsChange]);

  // Handle line dragging (moving the whole line)
  useEffect(() => {
    if (!isDraggingLine) return;

    // Store initial points when drag starts
    const initialStart = { ...currentPointsRef.current.start };
    const initialEnd = { ...currentPointsRef.current.end };
    const initialMidX = (initialStart.x + initialEnd.x) / 2;
    const initialMidY = (initialStart.y + initialEnd.y) / 2;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new midpoint position
      const newMidX = e.clientX - lineDragOffset.x;
      const newMidY = e.clientY - lineDragOffset.y;
      
      // Calculate delta from initial position
      const deltaX = newMidX - initialMidX;
      const deltaY = newMidY - initialMidY;
      
      // Move both points by the same delta
      const newStart = {
        x: initialStart.x + deltaX,
        y: initialStart.y + deltaY,
      };
      const newEnd = {
        x: initialEnd.x + deltaX,
        y: initialEnd.y + deltaY,
      };
      
      setStartPoint(newStart);
      setEndPoint(newEnd);
      currentPointsRef.current.start = newStart;
      currentPointsRef.current.end = newEnd;
      
      // Call onPointsChange during drag with mousePosition for group movement
      if (onPointsChange) {
        // Convert client coordinates to scene coordinates (approximate, may need zoom adjustment)
        onPointsChange(id, newStart, newEnd, { x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLine(false);
      
      // Use the ref values which are always up to date
      const finalStart = currentPointsRef.current.start;
      const finalEnd = currentPointsRef.current.end;
      
      // Update container position after drag completes
      const currentMinX = Math.min(finalStart.x, finalEnd.x);
      const currentMinY = Math.min(finalStart.y, finalEnd.y);
      setContainerPosition({ x: currentMinX, y: currentMinY });
      
      // Call onPointsChange with undefined mousePosition to signal drag end
      if (onPointsChange) {
        onPointsChange(id, finalStart, finalEnd, undefined);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLine, lineDragOffset, id, onPointsChange]);

  const handleLineClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not clicking on an endpoint
    const target = e.target as HTMLElement;
    if (target.tagName === 'circle') {
      return; // Let endpoint handle it
    }
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const handleEndpointClick = (e: React.MouseEvent) => {
    // Select the line when clicking on an endpoint (but don't start dragging if already dragging)
    if (!isDraggingStart && !isDraggingEnd) {
      e.stopPropagation();
      if (onClick) {
        onClick();
      }
    }
  };
  
  // Endpoint size - larger for easier clicking
  const endpointRadius = 6;
  const hitboxRadius = 12; // Larger invisible hitbox for easier clicking
  const lineHitboxWidth = 20; // Width of the invisible line hitbox
  
  // Calculate padding needed to prevent clipping
  // Need space for: endpoints (hitboxRadius), line hitbox (lineHitboxWidth/2)
  const padding = Math.max(
    hitboxRadius, // Endpoint hitboxes
    lineHitboxWidth / 2, // Half of line hitbox width
  );
  
  // Adjust container position to account for padding
  const containerX = minX - padding;
  const containerY = minY - padding;
  const containerWidth = width + (padding * 2);
  const containerHeight = height + (padding * 2);
  
  // Adjust line coordinates relative to the padded container
  const lineStartX = startPoint.x - containerX;
  const lineStartY = startPoint.y - containerY;
  const lineEndX = endPoint.x - containerX;
  const lineEndY = endPoint.y - containerY;

  return (
    <div
      data-line={id}
      className="absolute select-none"
      style={{
        left: `${containerX}px`,
        top: `${containerY}px`,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        pointerEvents: 'none', // Allow clicks to pass through container
        zIndex: isSelected ? 50 : 10,
      }}
    >
      <svg
        width={containerWidth}
        height={containerHeight}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }} // SVG background is not clickable
      >
        {/* Invisible wider hitbox for easier clicking (especially for straight lines) */}
        <line
          x1={lineStartX}
          y1={lineStartY}
          x2={lineEndX}
          y2={lineEndY}
          stroke="transparent"
          strokeWidth={20} // Wide hitbox for easy clicking
          strokeLinecap="round"
          style={{
            cursor: isDraggingLine ? 'grabbing' : 'grab',
            pointerEvents: 'stroke', // Only the stroke is clickable, not empty space
          }}
          onMouseDown={handleLineMouseDown}
          onClick={handleLineClick}
        />
        
        {/* Visible line */}
        <line
          ref={lineRef}
          x1={lineStartX}
          y1={lineStartY}
          x2={lineEndX}
          y2={lineEndY}
          stroke={isSelected ? '#2563eb' : color}
          strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
          strokeLinecap="round"
          style={{
            cursor: isDraggingLine ? 'grabbing' : 'grab',
            pointerEvents: 'none', // Let the invisible hitbox handle clicks
          }}
        />
        
        {/* Start endpoint - only visible when selected */}
        {isSelected && (
          <circle
            cx={lineStartX}
            cy={lineStartY}
            r={endpointRadius}
            fill="#2563eb"
            stroke="white"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity"
            style={{
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => {
              if (onMouseDownCallback) {
                onMouseDownCallback(id);
              }
              handleEndpointMouseDown(e, true);
              handleEndpointClick(e);
            }}
          />
        )}
        
        {/* End endpoint - only visible when selected */}
        {isSelected && (
          <circle
            cx={lineEndX}
            cy={lineEndY}
            r={endpointRadius}
            fill="#2563eb"
            stroke="white"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity"
            style={{
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => {
              if (onMouseDownCallback) {
                onMouseDownCallback(id);
              }
              handleEndpointMouseDown(e, false);
              handleEndpointClick(e);
            }}
          />
        )}
        
        {/* Larger invisible hitboxes for endpoints when selected - for easier clicking */}
        {isSelected && (
          <>
            <circle
              cx={lineStartX}
              cy={lineStartY}
              r={hitboxRadius}
              fill="transparent"
              stroke="transparent"
              style={{
                pointerEvents: 'all',
                cursor: 'grab',
              }}
              onMouseDown={(e) => {
                if (onMouseDownCallback) {
                  onMouseDownCallback(id);
                }
                handleEndpointMouseDown(e, true);
                handleEndpointClick(e);
              }}
            />
            <circle
              cx={lineEndX}
              cy={lineEndY}
              r={hitboxRadius}
              fill="transparent"
              stroke="transparent"
              style={{
                pointerEvents: 'all',
                cursor: 'grab',
              }}
              onMouseDown={(e) => {
                if (onMouseDownCallback) {
                  onMouseDownCallback(id);
                }
                handleEndpointMouseDown(e, false);
                handleEndpointClick(e);
              }}
            />
          </>
        )}

        {/* Selection indicator - dashed line overlay */}
        {isSelected && (
          <line
            x1={lineStartX}
            y1={lineStartY}
            x2={lineEndX}
            y2={lineEndY}
            stroke="#2563eb"
            strokeWidth={strokeWidth + 2}
            strokeDasharray="5,5"
            opacity={0.3}
            style={{
              pointerEvents: 'none',
            }}
          />
        )}
      </svg>
    </div>
  );
}

export default LineTool;

