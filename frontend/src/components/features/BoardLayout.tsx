import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../common/Button';
import { BoardSidebar } from './BoardSidebar';

interface BoardLayoutProps {
  children: React.ReactNode;
  onSpawnCard?: (position: { x: number; y: number }) => void;
  onSpawnBoard?: (position: { x: number; y: number }) => void;
  onSpawnLine?: (position: { x: number; y: number }) => void;
  onSpawnImage?: (position: { x: number; y: number }) => void;
  onSignOut?: () => void;
  zoom?: number;
  onZoomChange?: (updater: (z: number) => number) => void;
  onZoomReset?: () => void;
  isAdmin?: boolean;
}

/**
 * BoardLayout Component
 * 
 * Provides a consistent layout with header and sidebar for board views.
 * The header and sidebar are outside the zoom context, so they remain
 * unaffected by canvas zoom transformations.
 */
export function BoardLayout({
  children,
  onSpawnCard,
  onSpawnBoard,
  onSpawnLine,
  onSpawnImage,
  onSignOut,
  zoom = 1,
  onZoomChange,
  onZoomReset,
  isAdmin = false,
}: BoardLayoutProps): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header - Fixed at top, not affected by zoom */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-50 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-800">NoteSharp</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Zoom controls */}
            {onZoomChange && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                  onClick={() => onZoomChange(z => z - 0.1)}
                >
                  -
                </button>
                <span className="w-14 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                  onClick={() => onZoomChange(z => z + 0.1)}
                >
                  +
                </button>
                {onZoomReset && (
                  <button
                    type="button"
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 text-xs"
                    onClick={onZoomReset}
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                Admin
              </Link>
            )}
            {onSignOut && (
              <Button onClick={onSignOut} variant="secondary">
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Fixed size, not affected by zoom */}
        <BoardSidebar 
          isOpen={sidebarOpen} 
          onSpawnComponent={onSpawnCard}
          onSpawnBoard={onSpawnBoard}
          onSpawnLine={onSpawnLine}
          onSpawnImage={onSpawnImage}
        />

        {/* Canvas Area - This is where the zoomed content goes */}
        <main className="flex-1 overflow-hidden bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

export default BoardLayout;
