import React, { useState, useCallback } from "react";
import { useDrop } from "react-dnd";
import type { Group, DragItemType, DragCardItem, ViewMode } from "../types/group";
import { Button } from "./common";

interface GroupCardProps {
  group: Group;
  children?: React.ReactNode;
  viewMode: ViewMode;
  onToggleExpand: (groupId: string, expanded: boolean) => void;
  onRename: (groupId: string, newTitle: string) => void;
  onDelete: (groupId: string) => void;
  onCardDrop: (cardId: string, groupId: string) => void;
  cardCount?: number;
}

/**
 * GroupCard Component
 * 
 * A container for NoteCards with drag-and-drop support.
 * Supports collapsible/expandable state with animations.
 * Can display in list, grid, or queue view modes.
 */
export function GroupCard({
  group,
  children,
  viewMode,
  onToggleExpand,
  onRename,
  onDelete,
  onCardDrop,
  cardCount = 0,
}: GroupCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(group.title);
  const [showMenu, setShowMenu] = useState(false);

  // Drag and drop setup
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: "CARD" as any,
    drop: (item: DragCardItem) => {
      onCardDrop(item.id, group.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const setDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        drop(node);
      }
    },
    [drop]
  );

  const handleToggleExpand = () => {
    onToggleExpand(group.id, !group.expanded);
  };

  const handleStartEdit = () => {
    setEditTitle(group.title);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== group.title) {
      onRename(group.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(group.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete group "${group.title}"? This will ungroup all cards.`)) {
      onDelete(group.id);
    }
    setShowMenu(false);
  };

  // View mode specific classes
  const getContainerClasses = () => {
    const base = "group-card bg-white rounded-lg shadow-md border-2 transition-all duration-200";
    const dropClasses = isOver && canDrop ? "border-blue-500 bg-blue-50" : "border-gray-200";
    
    switch (viewMode) {
      case "grid":
        return `${base} ${dropClasses} min-h-[200px]`;
      case "queue":
        return `${base} ${dropClasses} mb-4`;
      case "list":
      default:
        return `${base} ${dropClasses} mb-4`;
    }
  };

  const getContentClasses = () => {
    switch (viewMode) {
      case "grid":
        return "grid grid-cols-1 gap-3 p-3";
      case "queue":
        return "flex flex-col gap-2 p-3";
      case "list":
      default:
        return "flex flex-col gap-3 p-3";
    }
  };

  return (
    <div ref={setDropRef} className={getContainerClasses()}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        {/* Expand/Collapse Button */}
        <button
          onClick={handleToggleExpand}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          aria-label={group.expanded ? "Collapse group" : "Expand group"}
        >
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${
              group.expanded ? "transform rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Title */}
        <div className="flex-1 mx-3">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              maxLength={100}
            />
          ) : (
            <h3
              className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600"
              onClick={handleStartEdit}
            >
              {group.title}
              <span className="ml-2 text-sm text-gray-500 font-normal">
                ({cardCount} {cardCount === 1 ? "card" : "cards"})
              </span>
            </h3>
          )}
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            aria-label="Group menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <button
                  onClick={handleStartEdit}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Group
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          group.expanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {group.expanded && (
          <div className={getContentClasses()}>
            {children}
            {cardCount === 0 && (
              <div className="text-center py-8 text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm">Drop cards here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupCard;
