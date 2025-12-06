import { vi, type Mock } from 'vitest';
import * as groupsApi from '../../src/api/groupsApi';

// Mock fetch
global.fetch = vi.fn();

describe('Groups API', () => {
  const mockBoardId = 'board-123';
  const mockToken = 'mock-token-123';
  const mockUser = {
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    token: mockToken
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockClear();
    // Mock localStorage
    localStorage.setItem('user', JSON.stringify(mockUser));
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('createGroup', () => {
    it('should create a group successfully', async () => {
      const mockResponse = { groupId: 'group-123', message: 'Success' };
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await groupsApi.createGroup(mockBoardId, 'Test Group');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/${mockBoardId}/groups`),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`
          },
          body: JSON.stringify({ title: 'Test Group' })
        })
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Creation failed' })
      });

      await expect(groupsApi.createGroup(mockBoardId, 'Test Group')).rejects.toThrow('Creation failed');
    });

    it('should throw error when user is not authenticated', async () => {
      localStorage.removeItem('user');

      await expect(groupsApi.createGroup(mockBoardId, 'Test Group')).rejects.toThrow('User is not authenticated');
    });
  });

  describe('getGroups', () => {
    it('should fetch groups successfully', async () => {
      const mockGroups = {
        groups: [
          { id: 'group1', title: 'Group 1' },
          { id: 'group2', title: 'Group 2' }
        ]
      };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockGroups
      });

      const result = await groupsApi.getGroups(mockBoardId);

      expect(result).toEqual(mockGroups);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/${mockBoardId}/groups`),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        })
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Fetch failed' })
      });

      await expect(groupsApi.getGroups(mockBoardId)).rejects.toThrow('Fetch failed');
    });
  });

  describe('updateGroup', () => {
    it('should update a group successfully', async () => {
      const mockResponse = { message: 'Success' };
      const updateData = { title: 'Updated Title', expanded: false };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await groupsApi.updateGroup(mockBoardId, 'group-123', updateData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/${mockBoardId}/groups/group-123`),
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`
          },
          body: JSON.stringify(updateData)
        })
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Update failed' })
      });

      await expect(groupsApi.updateGroup(mockBoardId, 'group-123', { title: 'New' })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group successfully', async () => {
      const mockResponse = { message: 'Success' };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await groupsApi.deleteGroup(mockBoardId, 'group-123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/${mockBoardId}/groups/group-123`),
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        })
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Delete failed' })
      });

      await expect(groupsApi.deleteGroup(mockBoardId, 'group-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('assignNoteToGroup', () => {
    it('should assign a note to a group', async () => {
      const mockResponse = { message: 'Success' };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await groupsApi.assignNoteToGroup(mockBoardId, 'note-123', 'group-123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/boards/${mockBoardId}/notes/note-123/group`),
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockToken}`
          },
          body: JSON.stringify({ groupId: 'group-123' })
        })
      );
    });

    it('should unassign a note when groupId is null', async () => {
      const mockResponse = { message: 'Success' };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      await groupsApi.assignNoteToGroup(mockBoardId, 'note-123', null);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify({ groupId: null })
        })
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Assignment failed' })
      });

      await expect(groupsApi.assignNoteToGroup(mockBoardId, 'note-123', 'group-123')).rejects.toThrow('Assignment failed');
    });
  });
});
