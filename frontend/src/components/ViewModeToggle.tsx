import React from "react";
import type { ViewMode } from "../types/group";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * ViewModeToggle Component
 * 
 * Toggle between list, grid, and queue view modes
 */
export function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: ViewModeToggleProps): React.ReactElement {
  const modes: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
    {
      mode: "list",
      label: "List View",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
    },
    {
      mode: "grid",
      label: "Grid View",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      ),
    },
    {
      mode: "queue",
      label: "Queue View",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {modes.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onViewModeChange(mode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            viewMode === mode
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:bg-gray-200"
          }`}
          aria-label={label}
          title={label}
        >
          {icon}
          <span className="hidden sm:inline text-sm font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default ViewModeToggle;
