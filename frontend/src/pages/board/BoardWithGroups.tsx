import React, { useState } from "react";
import { DragDropProvider } from "../../components/functional/DragDropProvider";
//import { GroupsContainer } from "../../components/GroupsContainer";
import { CreateGroupForm } from "../../components/CreateGroupForm";
import { CreateNoteForm } from "../../components/CreateNoteForm";
import { ViewModeToggle } from "../../components/ViewModeToggle";
import NoteCard from "../../components/NoteCard";
import { useGroupsRealtime } from "../../hooks/useGroupsRealtime";
import { useNotesGrouped } from "../../hooks/useNotesRealtime";
import { assignNoteToGroup } from "../../api/groupsApi";
import { updateGroup, deleteGroup } from "../../api/groupsApi";
import { createGroup as createGroupAPI } from "../../api/groupsApi";
import { createNote } from "../../api/notesApi";
import type { ViewMode } from "../../types/group";

interface BoardWithGroupsProps {
  boardId: string;
}

/**
 * BoardWithGroups Component
 * 
 * Main board view with group support, drag-and-drop, and multiple view modes.
 * Uses real-time Firestore subscriptions for live updates.
 */
export function BoardWithGroups({ boardId }: BoardWithGroupsProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [error, setError] = useState<string | null>(null);

  // Real-time subscriptions
  const { 
    groups, 
    loading: loadingGroups, 
    error: groupsError 
  } = useGroupsRealtime(boardId);
  
  const { 
    groupedNotes, 
    allNotes,
    loading: loadingNotes, 
    error: notesError 
  } = useNotesGrouped(boardId);

  // Get cards for a specific group
  const getGroupCards = (groupId: string) => {
    return groupedNotes[groupId] || [];
  };

  // Get ungrouped cards
  const ungroupedCards = groupedNotes['ungrouped'] || [];

  // Handle card drop
  const handleCardDrop = async (cardId: string, targetGroupId: string) => {
    try {
      await assignNoteToGroup(boardId, cardId, targetGroupId);
    } catch (err: any) {
      console.error('Error moving card:', err);
      setError(err.message || 'Failed to move card');
    }
  };

  // Handle group rename
  const handleRenameGroup = async (groupId: string, newTitle: string) => {
    try {
      await updateGroup(boardId, groupId, { title: newTitle });
    } catch (err: any) {
      console.error('Error renaming group:', err);
      setError(err.message || 'Failed to rename group');
    }
  };

  // Handle group delete
  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(boardId, groupId);
    } catch (err: any) {
      console.error('Error deleting group:', err);
      setError(err.message || 'Failed to delete group');
    }
  };

  // Handle create group
  const handleCreateGroup = async (title: string) => {
    try {
      await createGroupAPI(boardId, title);
    } catch (err: any) {
      console.error('Error creating group:', err);
      setError(err.message || 'Failed to create group');
    }
  };

  // Handle create note
  const handleCreateNote = async (title: string, content: string) => {
    try {
      await createNote(boardId, title, content, null); // null = ungrouped
      // Notes will update via polling
    } catch (err: any) {
      console.error('Error creating note:', err);
      setError(err.message || 'Failed to create note');
      throw err; // Re-throw so form can show error
    }
  };

  // Handle toggle expanded
  const handleToggleExpand = async (groupId: string, expanded: boolean) => {
    try {
      await updateGroup(boardId, groupId, { expanded });
    } catch (err: any) {
      console.error('Error toggling group:', err);
      setError(err.message || 'Failed to toggle group');
    }
  };

  // Render a card
  const renderCard = (card: any) => {
    return (
      <NoteCard
        key={card.id}
        value={{
          id: card.id,
          title: card.title,
          content: card.content || '',
          updatedAt: card.updatedAt
        }}
        onChange={(next) => {
          // Handle card update
          console.log('Card updated:', next);
        }}
        preview={true}
      />
    );
  };

  const loading = loadingGroups || loadingNotes;
  const displayError = error || groupsError || notesError;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading board...</p>
        </div>
      </div>
    );
  }

  if (displayError) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Groups</h3>
          <p className="text-red-600">{displayError}</p>
        </div>
      </div>
    );
  }

  return (
    <DragDropProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Board</h1>
              
              <div className="flex flex-wrap gap-4 items-center">
                <ViewModeToggle
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Create Group Form */}
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <CreateGroupForm onCreateGroup={handleCreateGroup} />
            {/* TODO: Enable when notes API is implemented
            <CreateNoteForm onCreateNote={handleCreateNote} />
            */}
          </div>
        </div>

        {/* Groups and Cards */}
        {/* <GroupsContainer
          groups={groups}
          viewMode={viewMode}
          onToggleExpand={handleToggleExpand}
          onRenameGroup={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
          onCardDrop={handleCardDrop}
          getGroupCards={getGroupCards}
          renderCard={renderCard}
          ungroupedCards={ungroupedCards}
        /> */}

        {/* Empty State */}
        {groups.length === 0 && allNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <svg
              className="w-24 h-24 text-gray-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No groups or cards yet
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              Create your first group to organize your cards, or add cards directly to
              get started.
            </p>
          </div>
        )}
      </div>
    </DragDropProvider>
  );
}

export default BoardWithGroups;
