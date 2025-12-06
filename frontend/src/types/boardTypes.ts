// ContentType enum - matches backend
export enum ContentType {
  TEXT = "text",
  HTML = "html",
  IMG = "img",
  CONTAINER = "container",
  LINE = "line",
  BOARD = "board"
}

export interface CardData {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
}

export interface BoardData {
  id: string; // Item ID (for updates/deletes)
  boardId?: string; // Actual board document ID (for navigation)
  position: { x: number; y: number };
  title: string;
  cardCount?: number;
}

export interface LineData {
  id: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

export interface SessionToken {
  email: string;
  displayName: string;
  UID: string;
}

export interface BoardItem {
  id: string;
  content: string;
  contentType: string;
  position: number[];
  size: number[];
}

