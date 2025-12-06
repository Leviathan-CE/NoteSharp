import { API_URL } from "../services/api";
import { auth } from "../services/firebase";

interface CreateBoardResponse {
  boardId: string;
  message: string;
}

interface CreateBoardError {
  error: string;
}

/**
 * Get the current user's Firebase ID token
 * @returns Promise containing the ID token
 * @throws Error if user is not authenticated
 */
export async function getCurrentUserToken(): Promise<string> {
  if (!auth) {
    throw new Error("Firebase auth is not configured. Please log in again.");
  }

  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("User not authenticated. Please log in.");
  }
  
  try {
    const idToken = await user.getIdToken();
    return idToken;
  } catch (error: any) {
    console.error("Error getting ID token:", error);
    throw new Error("Failed to get authentication token. Please log in again.");
  }
}

/**
 * Create a new board
 * @param title - The title of the board
 * @returns Promise containing the board ID
 * @throws Error if user is not authenticated or creation fails
 */
export async function createBoard(title: string): Promise<string> {
  // Validate title
  if (!title || typeof title !== "string" || title.trim() === "") {
    throw new Error("Board title is required");
  }

  // Get Firebase ID token
  const idToken = await getCurrentUserToken();

  try {
    const response = await fetch(`${API_URL}/boards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ title: title.trim() })
    });

    if (!response.ok) {
      const errorData: CreateBoardError = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data: CreateBoardResponse = await response.json();
    return data.boardId;

  } catch (error: any) {
    console.error("Error creating board:", error);
    
    // Handle specific error cases
    if (error.message.includes("401") || error.message.includes("authentication")) {
      throw new Error("Authentication failed. Please log in again.");
    }
    
    throw new Error(error.message || "Failed to create board");
  }
}
