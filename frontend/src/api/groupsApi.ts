const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Get the current authentication token from localStorage
 */
const getCurrentUserToken = async (): Promise<string> => {
  const storedToken = localStorage.getItem('authToken');
  if (storedToken) {
    return storedToken;
  }

  const user = localStorage.getItem('user');
  if (!user) {
    throw new Error('User is not authenticated');
  }
  
  try {
    const userData = JSON.parse(user);
    const token = userData.token; // Get the Firebase ID token
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }
    localStorage.setItem('authToken', token);
    return token;
  } catch (err) {
    console.error('Failed to parse stored user data:', err);
    localStorage.removeItem('user');
    throw new Error('Invalid user data');
  }
};

/**
 * Create a new group in a board
 */
export const createGroup = async (boardId: string, title: string): Promise<{ groupId: string; message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create group');
  }

  return response.json();
};

/**
 * Get all groups for a board
 */
export const getGroups = async (boardId: string): Promise<{ groups: any[] }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/groups`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch groups');
  }

  return response.json();
};

/**
 * List all groups for a board (alias for getGroups)
 */
export const listGroups = async (boardId: string): Promise<any[]> => {
  const result = await getGroups(boardId);
  return result.groups || [];
};

/**
 * Update a group (title, expanded state, or order)
 */
export const updateGroup = async (
  boardId: string,
  groupId: string,
  data: { title?: string; expanded?: boolean; order?: number }
): Promise<{ message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/groups/${groupId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update group');
  }

  return response.json();
};

/**
 * Delete a group
 */
export const deleteGroup = async (boardId: string, groupId: string): Promise<{ message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/groups/${groupId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete group');
  }

  return response.json();
};

/**
 * Assign a note to a group (used for drag-and-drop)
 */
export const assignNoteToGroup = async (
  boardId: string,
  noteId: string,
  groupId: string | null
): Promise<{ message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notes/${noteId}/group`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ groupId })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to assign note to group');
  }

  return response.json();
};
