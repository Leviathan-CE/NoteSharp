import React from 'react';
import { BoardWithGroups } from './BoardWithGroups';

/**
 * MainBoard component for all other boards and it self is a board 
 * @returns MainBoard component
 */
function MainBoard(): React.ReactElement {
    return (
        <div className="min-h-screen bg-gray-100">
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-800">NoteSharp</h1>
                        <p className="text-sm text-gray-500">Collaborate on shared boards in real time.</p>
                    </div>
                </div>
            </div>
            {/* Board with Groups and Notes */}
            <BoardWithGroups boardId="main-board" />
        </div>
    );
}

export default MainBoard;
