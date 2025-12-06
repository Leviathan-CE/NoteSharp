import { Timestamp } from "firebase-admin/firestore";

/**
 * Group interface - stored in Firestore at boards/{boardId}/groups/{groupId}
 */
export interface Group {
  id: string;
  title: string;
  boardId: string;
  ownerId: string;
  expanded: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Request body for creating a group
 */
export interface CreateGroupRequest {
  title: string;
}

/**
 * Request body for updating a group
 */
export interface UpdateGroupRequest {
  title?: string;
  expanded?: boolean;
  order?: number;
}

/**
 * Note with group assignment
 */
export interface NoteWithGroup {
  id: string;
  title: string;
  content: string;
  groupId: string | null;
  boardId: string;
  ownerId: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
