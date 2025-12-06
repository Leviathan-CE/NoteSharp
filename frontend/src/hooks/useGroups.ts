import { useState, useEffect, useCallback } from "react";
import type { Group } from "../types/group";
import {
  createGroup as createGroupAPI,
  getGroups as getGroupsAPI,
  updateGroup as updateGroupAPI,
  deleteGroup as deleteGroupAPI,
  assignNoteToGroup as assignNoteToGroupAPI,
} from "../api/groupsApi";

/**
 * Hook for managing groups in a board
 * 
 * @param boardId - The board ID
 * @returns Group management state and functions
 */
export function useGroups(boardId: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!boardId) return;

    try {
      setLoading(true);
      setError(null);
      const result = await getGroupsAPI(boardId);
      setGroups(result.groups);
    } catch (err: any) {
      console.error("Error fetching groups:", err);
      setError(err.message || "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  // Load groups on mount and when boardId changes
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Create a new group
  const createGroup = useCallback(
    async (title: string): Promise<string | null> => {
      try {
        setError(null);
        const result = await createGroupAPI(boardId, title);
        await fetchGroups(); // Refresh the list
        return result.groupId;
      } catch (err: any) {
        console.error("Error creating group:", err);
        setError(err.message || "Failed to create group");
        return null;
      }
    },
    [boardId, fetchGroups]
  );

  // Update a group
  const updateGroup = useCallback(
    async (groupId: string, data: { title?: string; expanded?: boolean; order?: number }): Promise<boolean> => {
      try {
        setError(null);
        await updateGroupAPI(boardId, groupId, data);
        
        // Update local state optimistically
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, ...data } : g
          )
        );
        
        return true;
      } catch (err: any) {
        console.error("Error updating group:", err);
        setError(err.message || "Failed to update group");
        await fetchGroups(); // Revert on error
        return false;
      }
    },
    [boardId, fetchGroups]
  );

  // Delete a group
  const deleteGroup = useCallback(
    async (groupId: string): Promise<boolean> => {
      try {
        setError(null);
        await deleteGroupAPI(boardId, groupId);
        
        // Update local state
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        
        return true;
      } catch (err: any) {
        console.error("Error deleting group:", err);
        setError(err.message || "Failed to delete group");
        return false;
      }
    },
    [boardId]
  );

  // Toggle group expanded state
  const toggleExpanded = useCallback(
    async (groupId: string, expanded: boolean): Promise<boolean> => {
      try {
        setError(null);
        
        // Update local state immediately for smooth UI
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, expanded } : g
          )
        );
        
        await updateGroupAPI(boardId, groupId, { expanded });
        return true;
      } catch (err: any) {
        console.error("Error toggling group:", err);
        setError(err.message || "Failed to toggle group");
        await fetchGroups(); // Revert on error
        return false;
      }
    },
    [boardId, fetchGroups]
  );

  // Move a card to a group
  const moveCardToGroup = useCallback(
    async (cardId: string, groupId: string | null): Promise<boolean> => {
      try {
        setError(null);
        await assignNoteToGroupAPI(boardId, cardId, groupId);
        return true;
      } catch (err: any) {
        console.error("Error moving card:", err);
        setError(err.message || "Failed to move card");
        return false;
      }
    },
    [boardId]
  );

  return {
    groups,
    loading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleExpanded,
    moveCardToGroup,
  };
}

/**
 * Hook for managing group state
 * Provides optimistic updates for better UX
 */
export function useGroupState(initialGroup: Group) {
  const [group, setGroup] = useState<Group>(initialGroup);

  useEffect(() => {
    setGroup(initialGroup);
  }, [initialGroup]);

  const updateGroupState = useCallback((updates: Partial<Group>) => {
    setGroup((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    group,
    updateGroupState,
  };
}
