import { useState, useEffect } from "react";
import type { Group } from "../types/group";
import { listGroups } from "../api/groupsApi";

/**
 * Hook for group synchronization via API polling
 * 
 * Polls the backend API for groups and updates state.
 * Uses polling instead of Firebase realtime since no Firebase config on frontend.
 * 
 * @param boardId - The board ID to fetch groups for
 * @returns Groups state with loading and error indicators
 */
export function useGroupsRealtime(boardId: string | null) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchGroups = async () => {
      try {
        const fetchedGroups = await listGroups(boardId);
        if (mounted) {
          setGroups(fetchedGroups);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error('Error fetching groups:', err);
        if (mounted) {
          setError(err.message || 'Failed to load groups');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchGroups();

    // Poll every 3 seconds for updates
    const interval = setInterval(fetchGroups, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [boardId]);

  return {
    groups,
    loading,
    error
  };
}
