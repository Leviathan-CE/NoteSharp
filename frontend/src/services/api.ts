export const API_URL = "http://localhost:8080/api";

interface UploadImageResponse {
  url: string;
  path?: string;
  originalName?: string;
}

export async function uploadImageFile(file: File): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_URL}/uploads/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = `Image upload failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = `${errorMessage} - ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function createBoard(title: string, description: string) {
  const res = await fetch(`${API_URL}/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  return res.json();
}

export async function createAccount(email: string, password: string, role?: string) {
  const res = await fetch(`${API_URL}/auth/create-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), // Only send email and password
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to create user account");
  }
  
  return res.json();
}

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) {
    let errorMessage = `Login failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function logoutUser() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get or create the root board for the current user
 */
export async function getOrCreateRootBoard(sessionToken: { email: string; displayName: string; UID: string }): Promise<string> {
  const res = await fetch(`${API_URL}/items/create-root-board`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, cursorPosition: [0, 0] }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get or create root board");
  }
  
  const data = await res.json();
  return data.boardId;
}

/**
 * Add an item to a board
 * Returns the item ID from the database (and boardId for BOARD items)
 */
export async function addItemToBoard(
  item: { content: string; contentType: string; position: number[]; size: number[] },
  sessionToken: { email: string; displayName: string; UID: string },
  parentBoardId: string,
  cursorPosition: number[] = [0, 0]
): Promise<{ itemId: string; boardId?: string }> {
  const res = await fetch(`${API_URL}/items/add-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item,
      sessionToken,
      parent: { id: parentBoardId },
      cursorPosition,
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to add item to board");
  }
  
  const data = await res.json();
  
  // Check for itemId (camelCase) or itemid (lowercase) - handle both cases
  const itemId = data.itemId || data.itemid;
  
  if (!itemId || typeof itemId !== 'string') {
    console.error('Invalid response structure:', data);
    throw new Error(`Invalid response: itemId is missing or invalid. Response was: ${JSON.stringify(data)}`);
  }
  
  return {
    itemId: String(itemId),
    boardId: data.boardId ? String(data.boardId) : undefined
  };
}

/**
 * Update an item in a board
 */
export async function updateBoardItem(
  boardId: string,
  sessionToken: { email: string; displayName: string; UID: string },
  itemId: string,
  updates: { position?: number[]; size?: number[]; content?: string }
): Promise<void> {
  const res = await fetch(`${API_URL}/items/update-item`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId,
      sessionToken,
      itemId,
      updates,
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to update item");
  }
}

/**
 * Remove an item from a board
 */
export async function removeItemFromBoard(
  item: { id: string; contentType: string },
  sessionToken: { email: string; displayName: string; UID: string },
  parentBoardId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/items/remove-item`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item,
      sessionToken,
      parent: { id: parentBoardId },
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to remove item");
  }
}

/**
 * Get an item from a board
 */
export async function getBoardItem(
  itemId: string,
  contentType: string,
  sessionToken: { email: string; displayName: string; UID: string },
  itemParentId?: string
): Promise<any> {
  if (!sessionToken || !sessionToken.UID) {
    throw new Error('Session token with UID is required');
  }

  const params = new URLSearchParams({
    itemId,
    contentType,
    ...(itemParentId && { itemParentId }),
  });
  
  // Backend expects JSON-encoded sessionToken in Authorization header
  const res = await fetch(`${API_URL}/items/get-item?${params}`, {
    method: "GET",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${JSON.stringify(sessionToken)}`
    },
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get item");
  }
  
  const data = await res.json();
  return data.item;
}

/**
 * Get all items from a board
 */
export async function getAllItemsFromBoard(
  boardId: string,
  sessionToken: { email: string; displayName: string; UID: string }
): Promise<Array<{ id: string; content: string; contentType: string; position: number[]; size: number[] }>> {
  if (!sessionToken || !sessionToken.UID) {
    throw new Error('Session token with UID is required');
  }

  const params = new URLSearchParams({
    boardId,
  });
  
  const url = `${API_URL}/items/get-all-items?${params}`;
  console.log('Fetching items from:', url);
  
  // Backend expects JSON-encoded sessionToken in Authorization header
  const res = await fetch(url, {
    method: "GET",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${JSON.stringify(sessionToken)}`
    },
  });
  
  if (!res.ok) {
    let errorMessage = `Failed to get all items: ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = `${errorMessage} - ${res.statusText}`;
    }
    
    // Log more details for 404 errors
    if (res.status === 404) {
      console.error('404 Not Found - Check if backend server is running on', API_URL);
      console.error('Requested URL:', url);
    }
    
    throw new Error(errorMessage);
  }

  const data = await res.json();
  console.log(data.items)
  return data.items;
}

export async function verifyAuthToken(idToken: string) {
  const res = await fetch(`${API_URL}/auth/verify-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }

  return res.json();
}

function buildAuthHeaders(authToken: string, extra: Record<string, string> = {}) {
  if (!authToken) {
    throw new Error("Missing authentication token");
  }

  return {
    Authorization: `Bearer ${authToken}`,
    ...extra
  };
}

export async function getServerConfiguration(authToken: string) {
  const res = await fetch(`${API_URL}/server-config`, {
    method: "GET",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load server configuration (${res.status})`);
  }

  return res.json();
}

export async function updateServerConfiguration(config: Record<string, unknown>, authToken: string) {
  const res = await fetch(`${API_URL}/server-config`, {
    method: "PUT",
    headers: buildAuthHeaders(authToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(config)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save configuration (${res.status})`);
  }

  return res.json();
}

export async function testServerConfigurationConnection(authToken: string) {
  const res = await fetch(`${API_URL}/server-config/test`, {
    method: "POST",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Connection test failed (${res.status})`);
  }

  return res.json();
}

export async function getAdminMetrics(authToken: string) {
  const res = await fetch(`${API_URL}/admin/metrics`, {
    method: "GET",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load admin metrics (${res.status})`);
  }

  return res.json();
}

export async function getSupportTickets(authToken: string) {
  const res = await fetch(`${API_URL}/support/tickets`, {
    method: "GET",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load support tickets (${res.status})`);
  }

  return res.json();
}

export async function updateAdminSettings(settings: Record<string, unknown>, authToken: string) {
  const res = await fetch(`${API_URL}/admin/settings`, {
    method: "PUT",
    headers: buildAuthHeaders(authToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(settings)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save settings (${res.status})`);
  }

  return res.json();
}

export async function getAdminSettings(authToken: string) {
  const res = await fetch(`${API_URL}/admin/settings`, {
    method: "GET",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load settings (${res.status})`);
  }

  return res.json();
}

export async function getSystemMetrics(authToken: string) {
  const res = await fetch(`${API_URL}/admin/system-metrics`, {
    method: "GET",
    headers: buildAuthHeaders(authToken)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to load system metrics (${res.status})`);
  }

  return res.json();
}
