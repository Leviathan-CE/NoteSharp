import { useState, useEffect } from "react";

export interface NoteWithGroup {
  id: string;
  title: string;
  content: string;
  groupId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  boardId: string;
  ownerId: string;
}

/**
 * Hook for note/card synchronization via API polling
 * 
 * For now, returns empty notes since we don't have a notes API endpoint yet.
 * This allows the groups UI to render without errors.
 * 
 * @param boardId - The board ID to fetch notes for
 * @param groupId - Optional group ID to filter notes by
 * @returns Notes state with loading and error indicators
 */
export function useNotesRealtime(boardId: string | null, groupId?: string | null) {
  const [notes, setNotes] = useState<NoteWithGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    // TODO: Implement API call to fetch notes when backend endpoint is ready
    // For now, return empty array so groups UI can render
    setNotes([]);
    setLoading(false);
    setError(null);
  }, [boardId, groupId]);

  return {
    notes,
    loading,
    error
  };
}

/**
 * Hook to get notes grouped by their groupId
 * 
 * @param boardId - The board ID
 * @returns Object mapping groupId to array of notes
 */
export function useNotesGrouped(boardId: string | null) {
  const { notes, loading, error } = useNotesRealtime(boardId);
  const [groupedNotes, setGroupedNotes] = useState<Record<string, NoteWithGroup[]>>({});

  useEffect(() => {
    const grouped: Record<string, NoteWithGroup[]> = {};
    
    notes.forEach(note => {
      const key = note.groupId || 'ungrouped';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(note);
    });

    // Sort each group by order
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.order - b.order);
    });

    setGroupedNotes(grouped);
  }, [notes]);

  return {
    groupedNotes,
    allNotes: notes,
    loading,
    error
  };
}
