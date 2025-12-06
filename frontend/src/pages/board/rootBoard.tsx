import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { 
  logoutUser, 
  getOrCreateRootBoard, 
  addItemToBoard, 
  updateBoardItem, 
  removeItemFromBoard,
  getAllItemsFromBoard
} from '../../services/api';
import NoteCard from '../../components/features/NoteCard';
import Board from '../../components/features/Board';
import { ComponentSpawnButton } from '../../components/features/ComponentSpawnButton';
import { BoardSidebar } from '../../components/features/BoardSidebar';
// ContentType enum - matches backend
enum ContentType {
  TEXT = "text",
  HTML = "html",
  IMG = "img",
  CONTAINER = "container",
  LINE = "line",
  BOARD = "board"
}

interface CardData {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
}

interface BoardData {
  id: string; // Item ID (for updates/deletes)
  boardId?: string; // Actual board document ID (for navigation)
  position: { x: number; y: number };
  title: string;
  cardCount?: number;
}

interface SessionToken {
  email: string;
  displayName: string;
  UID: string;
}

interface BoardItem {
  id: string;
  content: string;
  contentType: string;
  position: number[];
  size: number[];
}

/**
 * RootBoard Component
 * 
 * A blank board with header and sidebar similar to Milanote.
 * Provides an infinite canvas workspace with navigation sidebar.
 */
export default function RootBoard(): React.ReactElement {
  const navigate = useNavigate();
  const { boardId: urlBoardId } = useParams<{ boardId?: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cards, setCards] = useState<CardData[]>([]);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [rootBoardId, setRootBoardId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get session token from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setSessionToken({
        email: user.email || '',
        displayName: user.displayName || 'User',
        UID: user.uid || user.UID || '',
      });
    } else {
      // Redirect to login if no user
      navigate('/login');
    }
  }, [navigate]);

  // Get or create root board and load cards
  useEffect(() => {
    if (!sessionToken) return;

    const initializeBoard = async () => {
      try {
        setIsLoading(true);
        
        // Clear existing items when switching boards
        setCards([]);
        setBoards([]);
        
        // Get root board ID (needed for creating new items)
        const rootId = await getOrCreateRootBoard(sessionToken);
        setRootBoardId(rootId);
        
        // Determine which board to load: URL boardId or root board
        // urlBoardId is the board document ID (for child boards) or undefined (for root board)
        const boardToLoad = urlBoardId || rootId;
        setCurrentBoardId(boardToLoad);
        
        console.log('Loading board:', { urlBoardId, rootId, boardToLoad });

        // Load existing items from the board
        try {
          const items = await getAllItemsFromBoard(boardToLoad, sessionToken);
          
          // Convert board items to CardData and BoardData format
          if (items && Array.isArray(items)) {
            const loadedCards: CardData[] = items
              .filter((item: BoardItem) => item.contentType === ContentType.TEXT) // Only load TEXT items (cards)
              .map((item: BoardItem) => ({
                id: item.id,
                position: {
                  x: Array.isArray(item.position) ? item.position[0] : 0,
                  y: Array.isArray(item.position) ? item.position[1] : 0,
                },
                size: {
                  width: Array.isArray(item.size) ? item.size[0] : 256,
                  height: Array.isArray(item.size) ? item.size[1] : 200,
                },
                content: item.content || '',
              }));
            
            // Load boards and fetch their item counts
            const boardItems = items.filter((item: BoardItem) => item.contentType === ContentType.BOARD);
            console.log(`Loading ${boardItems.length} child boards and fetching their card counts...`);
            
            const loadedBoards: BoardData[] = await Promise.all(
              boardItems.map(async (item: BoardItem) => {
                const boardId = (item as any).boardId || item.id;
                let cardCount = 0;
                
                // Fetch items from this child board to count all items except lines
                try {
                  const childItems = await getAllItemsFromBoard(boardId, sessionToken);
                  // Count all items except LINE items
                  cardCount = childItems.filter((childItem: any) => childItem.contentType !== ContentType.LINE).length;
                  console.log(`Board ${boardId} (${item.content || 'Untitled'}) has ${cardCount} items (excluding lines)`);
                } catch (error) {
                  console.warn(`Failed to get item count for board ${boardId}:`, error);
                  cardCount = 0;
                }
                
                return {
                  id: item.id, // Item ID (for updates/deletes)
                  boardId: boardId, // Actual board document ID (for navigation)
                  position: {
                    x: Array.isArray(item.position) ? item.position[0] : 0,
                    y: Array.isArray(item.position) ? item.position[1] : 0,
                  },
                  title: item.content || 'Untitled Board',
                  cardCount,
                };
              })
            );
            
            console.log('Loaded boards with card counts:', loadedBoards.map(b => ({ id: b.id, title: b.title, cardCount: b.cardCount })));
            
            // Set cards and boards (will be empty arrays if no items)
            setCards(loadedCards);
            setBoards(loadedBoards);
          } else {
            // No items found, ensure empty state
            setCards([]);
            setBoards([]);
          }
        } catch (loadError: any) {
          // If loading items fails, clear state and show empty board
          console.warn('Failed to load existing items from board:', loadError);
          setCards([]);
          setBoards([]);
        }
      } catch (error: any) {
        console.error('Failed to initialize board:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeBoard();
  }, [sessionToken, urlBoardId]);


  const handleSpawnCard = async (position: { x: number; y: number }) => {
    if (!currentBoardId || !sessionToken) return;

    console.log('Adding card to board:', currentBoardId);

    // Create card in database first to get the real ID
    try {
      const result = await addItemToBoard(
        {
          content: '',
          contentType: ContentType.TEXT,
          position: [position.x, position.y],
          size: [256, 200],
        },
        sessionToken,
        currentBoardId,
        [position.x, position.y]
      );
      
      // Validate itemId before using it
      if (!result.itemId || typeof result.itemId !== 'string') {
        throw new Error('Invalid itemId received from server');
      }
      
      console.log('Item ID received:', result.itemId);
      
      // Create card in UI with the real database ID
      const trimmedId = result.itemId.trim();
      if (!trimmedId) {
        throw new Error('Item ID is empty after trimming');
      }
      
      const newCard: CardData = {
        id: trimmedId,
        position,
        size: { width: 256, height: 200 },
        content: '',
      };
      
      console.log('Creating card with ID:', newCard.id, 'at position:', position);
      setCards(prevCards => {
        // Double-check we're not adding a card with an empty ID
        if (!newCard.id || newCard.id.trim() === '') {
          console.error('Attempted to add card with empty ID, skipping');
          return prevCards;
        }
        return [...prevCards, newCard];
      });
    } catch (error: any) {
      console.error('Failed to create card in database:', error);
      // Show error to user - could add a toast notification here
      alert(`Failed to create card: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCardPositionChange = async (id: string, position: { x: number; y: number }) => {
    // Optimistically update UI using functional update
    setCards(prevCards => prevCards.map(card => 
      card.id === id ? { ...card, position } : card
    ));

    // Update in database
    if (!currentBoardId || !sessionToken) return;
    
    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { position: [position.x, position.y] }
      );
    } catch (error: any) {
      console.error('Failed to update card position:', error);
    }
  };

  const handleCardSizeChange = async (id: string, size: { width: number; height: number }) => {
    // Optimistically update UI using functional update
    setCards(prevCards => prevCards.map(card => 
      card.id === id ? { ...card, size } : card
    ));

    // Update in database
    if (!currentBoardId || !sessionToken) return;
    
    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { size: [size.width, size.height] }
      );
    } catch (error: any) {
      console.error('Failed to update card size:', error);
    }
  };

  const handleCardContentChange = (id: string, content: string) => {
    // Update UI immediately for responsive typing using functional update
    setCards(prevCards => prevCards.map(card => 
      card.id === id ? { ...card, content } : card
    ));
  };

  // Save content to database when editing finishes (on blur)
  const handleCardContentBlur = async (id: string, content: string) => {
    if (!currentBoardId || !sessionToken) return;
    
    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { content }
      );
    } catch (error: any) {
      console.error('Failed to update card content:', error);
    }
  };

  const handleCardDelete = async (id: string) => {
    if (!currentBoardId || !sessionToken) return;

    // Optimistically remove from UI using functional update
    let cardToDelete: CardData | undefined;
    setCards(prevCards => {
      cardToDelete = prevCards.find(card => card.id === id);
      return prevCards.filter(card => card.id !== id);
    });

    // Delete from database
    try {
      await removeItemFromBoard(
        { id, contentType: ContentType.TEXT },
        sessionToken,
        currentBoardId
      );
      
      // Update card count for parent board if we're in a child board
      // (The parent board's card count will be updated when it's reloaded)
    } catch (error: any) {
      console.error('Failed to delete card from database:', error);
      // Revert optimistic update on error using functional update
      if (cardToDelete) {
        setCards(prevCards => [...prevCards, cardToDelete!]);
      }
    }
  };

  // Board handlers
  const handleSpawnBoard = async (position: { x: number; y: number }) => {
    if (!currentBoardId || !sessionToken) return;

    try {
      const result = await addItemToBoard(
        {
          content: 'Untitled Board',
          contentType: ContentType.BOARD,
          position: [position.x, position.y],
          size: [200, 200], // Square board
        },
        sessionToken,
        currentBoardId,
        [position.x, position.y]
      );
      
      if (!result.itemId || typeof result.itemId !== 'string') {
        throw new Error('Invalid itemId received from server');
      }
      
      if (!result.boardId || typeof result.boardId !== 'string') {
        throw new Error('Invalid boardId received from server for child board');
      }
      
      const trimmedId = result.itemId.trim();
      const trimmedBoardId = result.boardId.trim();
      
      if (!trimmedId) {
        throw new Error('Item ID is empty after trimming');
      }
      
      if (!trimmedBoardId) {
        throw new Error('Board ID is empty after trimming');
      }
      
      const newBoard: BoardData = {
        id: trimmedId, // Item ID (for updates/deletes)
        boardId: trimmedBoardId, // Board document ID (for navigation)
        position,
        title: 'Untitled Board',
        cardCount: 0, // New board starts with 0 cards
      };
      
      console.log('Created child board:', newBoard);
      
      setBoards(prevBoards => [...prevBoards, newBoard]);
    } catch (error: any) {
      console.error('Failed to create board in database:', error);
      alert(`Failed to create board: ${error.message || 'Unknown error'}`);
    }
  };

  const handleBoardPositionChange = async (id: string, position: { x: number; y: number }) => {
    setBoards(prevBoards => prevBoards.map(board => 
      board.id === id ? { ...board, position } : board
    ));

    if (!currentBoardId || !sessionToken) return;
    
    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { position: [position.x, position.y] }
      );
    } catch (error: any) {
      console.error('Failed to update board position:', error);
    }
  };

  const handleBoardTitleChange = (id: string, title: string) => {
    setBoards(prevBoards => prevBoards.map(board => 
      board.id === id ? { ...board, title } : board
    ));
  };

  const handleBoardTitleBlur = async (id: string, title: string) => {
    if (!currentBoardId || !sessionToken) return;
    
    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { content: title }
      );
    } catch (error: any) {
      console.error('Failed to update board title:', error);
    }
  };

  const handleBoardDelete = async (id: string) => {
    if (!currentBoardId || !sessionToken) return;

    let boardToDelete: BoardData | undefined;
    setBoards(prevBoards => {
      boardToDelete = prevBoards.find(board => board.id === id);
      return prevBoards.filter(board => board.id !== id);
    });

    try {
      await removeItemFromBoard(
        { id, contentType: ContentType.BOARD },
        sessionToken,
        currentBoardId
      );
    } catch (error: any) {
      console.error('Failed to delete board from database:', error);
      if (boardToDelete) {
        setBoards(prevBoards => [...prevBoards, boardToDelete!]);
      }
    }
  };

  const handleBoardClick = (id: string) => {
    // Find the board to get its boardId (actual board document ID)
    const board = boards.find(b => b.id === id);
    // boardId is the actual board document ID, which is what we need for navigation
    // If boardId is not set, we can't navigate (this shouldn't happen for child boards)
    const boardIdToNavigate = board?.boardId;
    if (!boardIdToNavigate) {
      console.error('Cannot navigate: boardId is missing for board item:', id);
      return;
    }
    // Navigate to the board using the board document ID
    navigate(`/board/${boardIdToNavigate}`);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navbar with Sidebar Toggle */}
      <div className="flex items-center bg-blue-600">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-blue-700 text-white transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-5 h-5"
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
        <div className="flex-1">
          <Navbar />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <BoardSidebar 
          isOpen={sidebarOpen} 
          onSpawnComponent={handleSpawnCard}
          onSpawnBoard={handleSpawnBoard}
        />

        {/* Canvas Area */}
        <main className="flex-1 overflow-auto bg-gray-50" data-canvas="true">
          <div className="relative min-h-full p-8">
            {/* Loading State */}
            {isLoading && (
              <div className="max-w-7xl mx-auto">
                <div className="text-center py-20">
                  <div className="inline-block p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-sm text-gray-500">Loading board...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cards and Boards Container */}
            {!isLoading && (cards.length > 0 || boards.length > 0) && (
              <div className="absolute inset-0 p-8">
                {cards.map(card => (
                  <NoteCard
                    key={card.id}
                    id={card.id}
                    initialPosition={card.position}
                    initialSize={card.size}
                    initialValue={card.content}
                    onPositionChange={handleCardPositionChange}
                    onSizeChange={handleCardSizeChange}
                    onContentChange={handleCardContentChange}
                    onContentBlur={handleCardContentBlur}
                    onDelete={handleCardDelete}
                  />
                ))}
                {boards.map(board => (
                  <Board
                    key={board.id}
                    id={board.id}
                    initialPosition={board.position}
                    initialTitle={board.title}
                    cardCount={board.cardCount ?? 0}
                    onPositionChange={handleBoardPositionChange}
                    onTitleChange={handleBoardTitleChange}
                    onTitleBlur={handleBoardTitleBlur}
                    onDelete={handleBoardDelete}
                    onClick={handleBoardClick}
                  />
                ))}
              </div>
            )}

            {/* Empty State - Only show if no cards/boards and not loading */}
            {!isLoading && cards.length === 0 && boards.length === 0 && (
              <div className="max-w-7xl mx-auto">
                <div className="text-center py-20">
                  <div className="inline-block p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      Blank Canvas
                    </h3>
                    <p className="text-sm text-gray-500">
                      Drag the "+ Card" button to add cards to your board
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
