import { Timestamp } from "firebase/firestore";

/**
 * View mode for displaying groups and cards
 */
export type ViewMode = "list" | "grid" | "queue";

/**
 * Group document structure in Firestore
 * Stored at: boards/{boardId}/groups/{groupId}
 */
export interface Group {
  id: string;
  title: string;
  expanded: boolean;
  createdAt: Date;
  updatedAt: Date;
  order: number;
  boardId: string;
  ownerId: string;
}

/**
 * Data required to create a new group
 */
export interface CreateGroupData {
  title: string;
  boardId: string;
  expanded?: boolean;
  order?: number;
}

/**
 * Data for updating an existing group
 */
export interface UpdateGroupData {
  title?: string;
  expanded?: boolean;
  order?: number;
}

/**
 * NoteCard structure with optional group assignment
 */
export interface NoteCard {
  id: string;
  title: string;
  content: string;
  groupId?: string | null;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  boardId: string;
}

/**
 * Drag and drop item types
 */
export enum DragItemType {
  CARD = "CARD",
  GROUP = "GROUP",
}

/**
 * Drag item interface for cards
 */
export interface DragCardItem {
  type: DragItemType.CARD;
  id: string;
  groupId?: string | null;
  order: number;
}

/**
 * Drag item interface for groups
 */
export interface DragGroupItem {
  type: DragItemType.GROUP;
  id: string;
  order: number;
}

/**
 * Drop result when dropping a card
 */
export interface DropResult {
  groupId: string | null;
  targetIndex?: number;
}
