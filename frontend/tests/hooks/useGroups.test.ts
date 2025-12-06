import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroups } from '../../src/hooks/useGroups';
import * as groupsApi from '../../src/api/groupsApi';

// Mock the API
vi.mock('../../src/api/groupsApi');

const mockedGroupsApi = vi.mocked(groupsApi);

describe('useGroups Hook', () => {
  const mockBoardId = 'test-board-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchGroups', () => {
    it('should fetch groups successfully', async () => {
      const mockGroups = [
        { id: 'group1', title: 'Group 1', expanded: true, order: 0, boardId: mockBoardId, ownerId: 'user1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'group2', title: 'Group 2', expanded: false, order: 1, boardId: mockBoardId, ownerId: 'user1', createdAt: new Date(), updatedAt: new Date() }
      ];

      mockedGroupsApi.getGroups.mockResolvedValue({ groups: mockGroups });

      const { result } = renderHook(() => useGroups(mockBoardId));

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.groups).toEqual(mockGroups);
      expect(result.current.error).toBeNull();
      expect(mockedGroupsApi.getGroups).toHaveBeenCalledWith(mockBoardId);
    });

    it('should handle fetch errors', async () => {
      const errorMessage = 'Failed to fetch groups';
      mockedGroupsApi.getGroups.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.groups).toEqual([]);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('createGroup', () => {
    it('should create a group successfully', async () => {
      const mockGroupId = 'new-group-123';
      mockedGroupsApi.createGroup.mockResolvedValue({ groupId: mockGroupId, message: 'Success' });
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [] });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const groupId = await result.current.createGroup('New Group');

      expect(groupId).toBe(mockGroupId);
      expect(mockedGroupsApi.createGroup).toHaveBeenCalledWith(mockBoardId, 'New Group');
    });

    it('should handle create errors', async () => {
      const errorMessage = 'Failed to create group';
      mockedGroupsApi.createGroup.mockRejectedValue(new Error(errorMessage));
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [] });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const groupId = await result.current.createGroup('New Group');

      expect(groupId).toBeNull();
      
      // Wait for error state to update
      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('updateGroup', () => {
    it('should update a group successfully', async () => {
      const mockGroup = { 
        id: 'group1', 
        title: 'Original', 
        expanded: true, 
        order: 0,
        boardId: mockBoardId,
        ownerId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [mockGroup] });
      mockedGroupsApi.updateGroup.mockResolvedValue({ message: 'Success' });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.updateGroup('group1', { title: 'Updated' });

      expect(success).toBe(true);
      expect(mockedGroupsApi.updateGroup).toHaveBeenCalledWith(mockBoardId, 'group1', { title: 'Updated' });
      
      // Wait for state update to reflect
      await waitFor(() => {
        expect(result.current.groups[0].title).toBe('Updated');
      });
    });

    it('should revert changes on error', async () => {
      const mockGroup = { 
        id: 'group1', 
        title: 'Original', 
        expanded: true, 
        order: 0,
        boardId: mockBoardId,
        ownerId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [mockGroup] });
      mockedGroupsApi.updateGroup.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.updateGroup('group1', { title: 'Updated' });

      await waitFor(() => {
        expect(result.current.groups[0].title).toBe('Original');
      });

      expect(success).toBe(false);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group successfully', async () => {
      const mockGroups = [
        { id: 'group1', title: 'Group 1', expanded: true, order: 0, boardId: mockBoardId, ownerId: 'user1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'group2', title: 'Group 2', expanded: false, order: 1, boardId: mockBoardId, ownerId: 'user1', createdAt: new Date(), updatedAt: new Date() }
      ];

      mockedGroupsApi.getGroups.mockResolvedValue({ groups: mockGroups });
      mockedGroupsApi.deleteGroup.mockResolvedValue({ message: 'Success' });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.deleteGroup('group1');

      expect(success).toBe(true);
      expect(mockedGroupsApi.deleteGroup).toHaveBeenCalledWith(mockBoardId, 'group1');
      
      // Wait for state update to reflect
      await waitFor(() => {
        expect(result.current.groups).toHaveLength(1);
      });
      
      expect(result.current.groups[0].id).toBe('group2');
    });
  });

  describe('toggleExpanded', () => {
    it('should toggle group expanded state', async () => {
      const mockGroup = { 
        id: 'group1', 
        title: 'Group 1', 
        expanded: true, 
        order: 0,
        boardId: mockBoardId,
        ownerId: 'user1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [mockGroup] });
      mockedGroupsApi.updateGroup.mockResolvedValue({ message: 'Success' });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.toggleExpanded('group1', false);

      expect(success).toBe(true);
      
      // Wait for state update to reflect
      await waitFor(() => {
        expect(result.current.groups[0].expanded).toBe(false);
      });
      
      expect(mockedGroupsApi.updateGroup).toHaveBeenCalledWith(mockBoardId, 'group1', { expanded: false });
    });
  });

  describe('moveCardToGroup', () => {
    it('should move a card to a group', async () => {
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [] });
      mockedGroupsApi.assignNoteToGroup.mockResolvedValue({ message: 'Success' });

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.moveCardToGroup('card1', 'group1');

      expect(success).toBe(true);
      expect(mockedGroupsApi.assignNoteToGroup).toHaveBeenCalledWith(mockBoardId, 'card1', 'group1');
    });

    it('should handle move errors', async () => {
      mockedGroupsApi.getGroups.mockResolvedValue({ groups: [] });
      mockedGroupsApi.assignNoteToGroup.mockRejectedValue(new Error('Move failed'));

      const { result } = renderHook(() => useGroups(mockBoardId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.moveCardToGroup('card1', 'group1');

      expect(success).toBe(false);
      
      // Wait for error state to update
      await waitFor(() => {
        expect(result.current.error).toBe('Move failed');
      });
    });
  });
});
