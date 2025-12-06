import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

interface DragDropProviderProps {
  children: React.ReactNode;
}

/**
 * DragDropProvider component
 * 
 * Wraps the application with react-dnd context
 * to enable drag-and-drop functionality.
 */
export function DragDropProvider({ children }: DragDropProviderProps): React.ReactElement {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}

export default DragDropProvider;
