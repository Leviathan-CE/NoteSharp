import React, { useState, useEffect } from 'react';
import DraggableWrapper from '../functional/DraggableWrapper';

interface BoardProps {
  /** Unique identifier for this board */
  id: string;
  /** Initial position on the canvas */
  initialPosition?: { x: number; y: number };
  /** Initial title/label */
  initialTitle?: string;
  /** Number of cards in the board */
  cardCount?: number;
  /** Callback when position changes */
  onPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** Callback when title changes */
  onTitleChange?: (id: string, title: string) => void;
  /** Callback when title editing finishes (on blur) */
  onTitleBlur?: (id: string, title: string) => void;
  /** Callback when board is deleted */
  onDelete?: (id: string) => void;
  /** Callback when board is clicked (for selection) */
  onClick?: (id: string) => void;
  /** Callback when board is double-clicked (e.g., to navigate to it) */
  onDoubleClick?: (id: string) => void;
  /** Whether the board is currently selected */
  isSelected?: boolean;
  /** Size of the square board preview area (width = height) */
  size?: number;
  /** Size of the editable section (title area) width */
  editableSize?: number;
  /** Callback when mouse down occurs on the board */
  onMouseDown?: (id: string) => void;
  /** Current zoom level (default: 1) - used to scale movement */
  zoom?: number;
}

/**
 * Board Component
 * 
 * A draggable square board component with an editable label on the bottom.
 * Cannot be resized - maintains a fixed square shape.
 * Similar to a board card in Milanote or Notion.
 * 
 * @example
 * ```tsx
 * <Board
 *   id="board-1"
 *   initialPosition={{ x: 100, y: 100 }}
 *   initialTitle="My Board"
 *   onTitleChange={(id, title) => console.log(title)}
 *   onClick={(id) => navigate(`/board/${id}`)}
 * />
 * ```
 */
export function Board({
  id,
  initialPosition = { x: 100, y: 100 },
  initialTitle = 'Untitled Board',
  cardCount = 0,
  onPositionChange,
  onTitleChange,
  onTitleBlur,
  onDelete,
  onClick,
  onDoubleClick,
  isSelected = false,
  size = 75, // Default square size
  editableSize = 150, // If not provided, uses board size
  onMouseDown,
  zoom = 1,
}: BoardProps): React.ReactElement {
  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (onTitleChange) {
      onTitleChange(id, newTitle);
    }
  };

  const handleTitleFocus = () => {
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (onTitleBlur) {
      onTitleBlur(id, title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setTitle(initialTitle);
      setIsEditingTitle(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(id);
    }
  };

  const handleBoardDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas click handler
    if (onDoubleClick && !isEditingTitle) {
      onDoubleClick(id);
    }
  };

  return (
    <DraggableWrapper
      id={id}
      initialPosition={initialPosition}
      onPositionChange={onPositionChange}
      onMouseDown={onMouseDown}
      zoom={zoom}
    >
      <div
        data-board={id}
        className="bg-transparent rounded-lg transition-all cursor-pointer group"
        style={{
          width: `${editableSize ?? size}px`,
        }}
      >
        {/* Main Board Preview Area */}
        <div 
          className="relative rounded-t-lg overflow-hidden bg-transparent flex items-center justify-center"
          style={{
            height: `${size * 0.7}px`,
          }}
        >
          {/* Rounded Square - Selectable */}
          <div 
            className={`rounded-lg transition-all ${
              isSelected ? 'border-2 border-blue-500' : 'border-2 border-gray-300'
            }`}
            style={{
              width: `${size * 0.7}px`,
              height: `${size * 0.7}px`,
              backgroundColor: '#F8F8F8',
            }}
            onDoubleClick={handleBoardDoubleClick}
            onClick={(e) => {
              // Only trigger onClick if not clicking on delete button
              if ((e.target as HTMLElement).closest('button')) {
                return;
              }
              e.stopPropagation(); // Prevent canvas click handler from clearing selection
              if (onClick) {
                onClick(id);
              }
            }}
          />
        </div>

        {/* Bottom Section with Title and Card Count - Not selectable */}
        <div 
          className="px-3 py-2 bg-transparent rounded-b-lg flex flex-col"
          onClick={(e) => {
            // Prevent selection when clicking on the editable section
            e.stopPropagation();
          }}
        >
          {/* Editable Title */}
          <div className="mb-1 text-center">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="w-full px-2 py-1 text-base font-semibold border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-[#333F4D] text-center"
                autoFocus
                maxLength={100}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleTitleFocus();
                }}
                className="text-base font-semibold text-[#333F4D] cursor-text hover:bg-gray-50 rounded px-1 py-0.5 transition-colors text-center"
                title={title}
              >
                {title || 'New Board'}
              </div>
            )}
          </div>

          {/* Item Count - Centered at bottom */}
          <div className="text-sm text-[#808080] text-center mt-auto">
            {cardCount} {cardCount === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>
    </DraggableWrapper>
  );
}

export default Board;

