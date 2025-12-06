import React, { useCallback } from "react";
import { useDrag } from "react-dnd";
import type { DragCardItem } from "../types/group";

interface DraggableCardProps {
  cardId: string;
  groupId?: string | null;
  order: number;
  children: React.ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * DraggableCard wrapper component
 * 
 * Wraps a NoteCard component to make it draggable
 * using react-dnd.
 */
export function DraggableCard({
  cardId,
  groupId,
  order,
  children,
  onDragStart,
  onDragEnd,
}: DraggableCardProps): React.ReactElement {
  const [{ isDragging }, drag] = useDrag({
    type: "CARD",
    item: (): DragCardItem => {
      if (onDragStart) onDragStart();
      return {
        type: "CARD" as any,
        id: cardId,
        groupId,
        order,
      };
    },
    end: () => {
      if (onDragEnd) onDragEnd();
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const setDragRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        drag(node);
      }
    },
    [drag]
  );

  return (
    <div
      ref={setDragRef}
      className={`transition-opacity duration-200 ${
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab"
      }`}
    >
      {children}
    </div>
  );
}

export default DraggableCard;
