import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db } from "../services/firebase";
import type { Group, CreateGroupData, UpdateGroupData } from "../types/group";

function getFirestore(): Firestore {
  if (!db) {
    throw new Error("Firestore is not configured for the client environment.");
  }
  return db;
}

/**
 * Create a new group in Firestore
 * @param data - Group creation data
 * @returns Promise with the created group ID
 */
export async function createGroup(data: CreateGroupData): Promise<string> {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Group title is required");
  }

  if (!data.boardId) {
    throw new Error("Board ID is required");
  }

  try {
    const firestore = getFirestore();
    const groupsRef = collection(firestore, "boards", data.boardId, "groups");
    
    // Get current count for order
    const snapshot = await getDocs(groupsRef);
    const order = data.order ?? snapshot.size;

    const groupData = {
      title: data.title.trim(),
      expanded: data.expanded ?? true,
      createdAt: Timestamp.now(),
      order,
      boardId: data.boardId,
    };

    const docRef = await addDoc(groupsRef, groupData);
    return docRef.id;
  } catch (error: any) {
    console.error("Error creating group:", error);
    throw new Error(error.message || "Failed to create group");
  }
}

/**
 * Get all groups for a board
 * @param boardId - Board ID
 * @returns Promise with array of groups
 */
export async function getGroups(boardId: string): Promise<Group[]> {
  if (!boardId) {
    throw new Error("Board ID is required");
  }

  try {
    const firestore = getFirestore();
    const groupsRef = collection(firestore, "boards", boardId, "groups");
    const q = query(groupsRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    const groups: Group[] = [];
    snapshot.forEach((doc) => {
      groups.push({
        id: doc.id,
        ...doc.data(),
      } as Group);
    });

    return groups;
  } catch (error: any) {
    console.error("Error fetching groups:", error);
    throw new Error(error.message || "Failed to fetch groups");
  }
}

/**
 * Get a single group by ID
 * @param boardId - Board ID
 * @param groupId - Group ID
 * @returns Promise with group data
 */
export async function getGroup(boardId: string, groupId: string): Promise<Group> {
  if (!boardId || !groupId) {
    throw new Error("Board ID and Group ID are required");
  }

  try {
    const firestore = getFirestore();
    const groupRef = doc(firestore, "boards", boardId, "groups", groupId);
    const snapshot = await getDoc(groupRef);

    if (!snapshot.exists()) {
      throw new Error("Group not found");
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Group;
  } catch (error: any) {
    console.error("Error fetching group:", error);
    throw new Error(error.message || "Failed to fetch group");
  }
}

/**
 * Update a group
 * @param boardId - Board ID
 * @param groupId - Group ID
 * @param data - Update data
 * @returns Promise<void>
 */
export async function updateGroup(
  boardId: string,
  groupId: string,
  data: UpdateGroupData
): Promise<void> {
  if (!boardId || !groupId) {
    throw new Error("Board ID and Group ID are required");
  }

  if (data.title !== undefined && data.title.trim() === "") {
    throw new Error("Group title cannot be empty");
  }

  try {
    const firestore = getFirestore();
    const groupRef = doc(firestore, "boards", boardId, "groups", groupId);
    const updateData: any = {};

    if (data.title !== undefined) {
      updateData.title = data.title.trim();
    }
    if (data.expanded !== undefined) {
      updateData.expanded = data.expanded;
    }
    if (data.order !== undefined) {
      updateData.order = data.order;
    }

    await updateDoc(groupRef, updateData);
  } catch (error: any) {
    console.error("Error updating group:", error);
    throw new Error(error.message || "Failed to update group");
  }
}

/**
 * Delete a group and optionally its cards
 * @param boardId - Board ID
 * @param groupId - Group ID
 * @param deleteCards - Whether to delete cards in the group
 * @returns Promise<void>
 */
export async function deleteGroup(
  boardId: string,
  groupId: string,
  deleteCards: boolean = false
): Promise<void> {
  if (!boardId || !groupId) {
    throw new Error("Board ID and Group ID are required");
  }

  try {
    const firestore = getFirestore();
    const batch = writeBatch(firestore);
    const groupRef = doc(firestore, "boards", boardId, "groups", groupId);

    if (deleteCards) {
      // Delete all cards in this group
      const cardsRef = collection(firestore, "boards", boardId, "cards");
      const cardsSnapshot = await getDocs(cardsRef);
      
      cardsSnapshot.forEach((cardDoc) => {
        if (cardDoc.data().groupId === groupId) {
          batch.delete(cardDoc.ref);
        }
      });
    } else {
      // Unassign cards from this group
      const cardsRef = collection(firestore, "boards", boardId, "cards");
      const cardsSnapshot = await getDocs(cardsRef);
      
      cardsSnapshot.forEach((cardDoc) => {
        if (cardDoc.data().groupId === groupId) {
          batch.update(cardDoc.ref, { groupId: null });
        }
      });
    }

    // Delete the group
    batch.delete(groupRef);
    await batch.commit();
  } catch (error: any) {
    console.error("Error deleting group:", error);
    throw new Error(error.message || "Failed to delete group");
  }
}

/**
 * Toggle group expanded state
 * @param boardId - Board ID
 * @param groupId - Group ID
 * @param expanded - New expanded state
 * @returns Promise<void>
 */
export async function toggleGroupExpanded(
  boardId: string,
  groupId: string,
  expanded: boolean
): Promise<void> {
  return updateGroup(boardId, groupId, { expanded });
}

/**
 * Reorder groups
 * @param boardId - Board ID
 * @param groupOrders - Array of {groupId, order} pairs
 * @returns Promise<void>
 */
export async function reorderGroups(
  boardId: string,
  groupOrders: Array<{ groupId: string; order: number }>
): Promise<void> {
  if (!boardId) {
    throw new Error("Board ID is required");
  }

  try {
    const firestore = getFirestore();
    const batch = writeBatch(firestore);

    groupOrders.forEach(({ groupId, order }) => {
      const groupRef = doc(firestore, "boards", boardId, "groups", groupId);
      batch.update(groupRef, { order });
    });

    await batch.commit();
  } catch (error: any) {
    console.error("Error reordering groups:", error);
    throw new Error(error.message || "Failed to reorder groups");
  }
}

/**
 * Move a card to a group
 * @param boardId - Board ID
 * @param cardId - Card ID
 * @param groupId - Target group ID (null for ungrouped)
 * @param order - Optional order within group
 * @returns Promise<void>
 */
export async function moveCardToGroup(
  boardId: string,
  cardId: string,
  groupId: string | null,
  order?: number
): Promise<void> {
  if (!boardId || !cardId) {
    throw new Error("Board ID and Card ID are required");
  }

  try {
    const firestore = getFirestore();
    const cardRef = doc(firestore, "boards", boardId, "cards", cardId);
    const updateData: any = { groupId };

    if (order !== undefined) {
      updateData.order = order;
    }

    await updateDoc(cardRef, updateData);
  } catch (error: any) {
    console.error("Error moving card to group:", error);
    throw new Error(error.message || "Failed to move card to group");
  }
}
