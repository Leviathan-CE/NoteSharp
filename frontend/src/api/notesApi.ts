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
      throw new Error('No authentication token found');
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
 * Create a new note in a board
 */
export const createNote = async (
  boardId: string,
  title: string,
  content: string,
  groupId?: string | null
): Promise<{ noteId: string; message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title, content, groupId: groupId || null })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create note');
  }

  return response.json();
};

/**
 * Get all notes for a board
 */
export const getNotes = async (boardId: string): Promise<{ notes: any[] }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notes`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch notes');
  }

  return response.json();
};

/**
 * Update a note
 */
export const updateNote = async (
  boardId: string,
  noteId: string,
  data: { title?: string; content?: string; groupId?: string | null }
): Promise<{ message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notes/${noteId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update note');
  }

  return response.json();
};

/**
 * Delete a note
 */
export const deleteNote = async (boardId: string, noteId: string): Promise<{ message: string }> => {
  const token = await getCurrentUserToken();
  
  const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notes/${noteId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete note');
  }

  return response.json();
};
