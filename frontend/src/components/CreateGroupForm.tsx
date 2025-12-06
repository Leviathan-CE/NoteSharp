import React, { useState } from "react";
import { Button, Input } from "./common";

interface CreateGroupFormProps {
  onCreateGroup: (title: string) => Promise<void>;
  loading?: boolean;
}

/**
 * CreateGroupForm Component
 * 
 * Form for creating new groups
 */
export function CreateGroupForm({
  onCreateGroup,
  loading = false,
}: CreateGroupFormProps): React.ReactElement {
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError("Please enter a group name");
      return;
    }

    try {
      setError("");
      await onCreateGroup(title);
      setTitle("");
      setIsExpanded(false);
    } catch (err: any) {
      setError(err.message || "Failed to create group");
    }
  };

  if (!isExpanded) {
    return (
      <div className="p-4">
        <Button
          onClick={() => setIsExpanded(true)}
          variant="primary"
          className="w-full sm:w-auto"
        >
          <svg
            className="w-5 h-5 mr-2 inline-block"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Group
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="Group Name"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter group name..."
            disabled={loading}
            maxLength={100}
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-600" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !title.trim()}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsExpanded(false);
              setTitle("");
              setError("");
            }}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CreateGroupForm;
