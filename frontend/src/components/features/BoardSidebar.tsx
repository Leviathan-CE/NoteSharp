import React from 'react';
import { useNavigate } from 'react-router-dom';
import ComponentSpawnButton from './ComponentSpawnButton';

interface BoardSidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback to toggle sidebar */
  onToggle?: () => void;
  /** Callback when a component should be spawned */
  onSpawnComponent?: (position: { x: number; y: number }) => void;
  /** Callback when an image should be spawned */
  onSpawnImage?: (position: { x: number; y: number }) => void;
  /** Callback when a board should be spawned */
  onSpawnBoard?: (position: { x: number; y: number }) => void;
  /** Callback when a line should be spawned */
  onSpawnLine?: (position: { x: number; y: number }) => void;
}

/**
 * BoardSidebar Component
 * 
 * Sidebar navigation for the board view, similar to Milanote.
 * Contains board navigation, templates, and other board-related actions.
 */
export function BoardSidebar({
  isOpen,
  onToggle,
  onSpawnComponent,
  onSpawnImage,
  onSpawnBoard,
  onSpawnLine,
}: BoardSidebarProps): React.ReactElement {
  const navigate = useNavigate();

  

  return (
    <aside
      className={`${
        isOpen ? 'w-32' : 'w-0'
      } bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 overflow-hidden`}
    >
      <div className="h-full flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Cards</h2>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {onSpawnComponent && (
              <li>
                <ComponentSpawnButton 
                  label="Note" 
                  onSpawnComponent={onSpawnComponent}
                  className='w-full' 
                />
              </li>
            )}
            
          </ul>

          {/* Divider */}
          <div className="my-4 border-t border-gray-200"></div>

          <ul className="space-y-1">
          {onSpawnLine && (
            
              <li>
                <ComponentSpawnButton 
                  label="Line" 
                  onSpawnComponent={onSpawnLine}
                  className='w-full' 
                />
              </li>
            )}
          </ul>
          {/* Divider */}
          <div className="my-4 border-t border-gray-200"></div>

          {/* Create New Board */}
          <ul className="space-y-1">
          {onSpawnBoard && (
            <ul className="space-y-1">
              <li>
                <ComponentSpawnButton 
                  label="Board" 
                  onSpawnComponent={onSpawnBoard}
                  className='w-full' 
                />
              </li>
            </ul>
          )}
          </ul>
          {/* Divider */}
          <div className="my-4 border-t border-gray-200"></div>

          {/* Add Image */}
          <ul className="space-y-1">
          {onSpawnImage && (
              <li>
                <ComponentSpawnButton 
                  label="Image Upload" 
                  onSpawnComponent={onSpawnImage}
                  className='w-full' 
                />
              </li>
            )}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors text-sm"
            onClick={() => navigate('/about')}
          >
            About
          </button>
        </div>
      </div>
    </aside>
  );
}

export default BoardSidebar;
