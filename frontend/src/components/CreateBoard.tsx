import React, { useState } from "react";
import { createBoard } from "../api/boards";
import { Button, Input } from "./common";

interface CreateBoardProps {
  /**
   * Callback function called when a board is successfully created
   * @param boardId - The ID of the newly created board
   */
  onCreated?: (boardId: string) => void;
  
  /**
   * Optional CSS class name for the container
   */
  className?: string;
}

/**
 * CreateBoard Component
 * 
 * A form component for creating new boards. Requires user to be authenticated.
 * 
 * Features:
 * - Input validation
 * - Loading state during creation
 * - Error handling and display
 * - Success callback with board ID
 * 
 * @example
 * ```tsx
 * <CreateBoard 
 *   onCreated={(boardId) => navigate(`/board/${boardId}`)} 
 * />
 * ```
 */
export function CreateBoard({ onCreated, className = "" }: CreateBoardProps): React.ReactElement {
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset states
    setError("");
    setSuccess("");
    
    // Validate title
    if (!title.trim()) {
      setError("Please enter a board title");
      return;
    }

    setIsLoading(true);

    try {
      // Call the API to create the board
      const boardId = await createBoard(title);
      
      // Show success message
      setSuccess("Board created successfully!");
      
      // Clear the input
      setTitle("");
      
      // Call the onCreated callback if provided
      if (onCreated) {
        onCreated(boardId);
      }
    } catch (err: any) {
      console.error("Error creating board:", err);
      
      // Display user-friendly error message
      if (err.message.includes("not authenticated") || err.message.includes("Authentication failed")) {
        setError("You must be logged in to create a board. Please log in and try again.");
      } else if (err.message.includes("title is required")) {
        setError("Please enter a valid board title.");
      } else {
        setError(err.message || "Failed to create board. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle input change
   */
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  return (
    <div className={`create-board ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Board Title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            disabled={isLoading}
            placeholder="Enter board title..."
            required
            //maxLength={100}
          />
        </div>

        {/* Error message */}
        {error && (
          <div 
            className="p-3 bg-red-100 border border-red-400 text-red-700 rounded"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div 
            className="p-3 bg-green-100 border border-green-400 text-green-700 rounded"
            role="status"
          >
            {success}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !title.trim()}
          className="w-full"
        >
          {isLoading ? "Creating Board..." : "Create Board"}
        </Button>
      </form>
    </div>
  );
}

export default CreateBoard;
