import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  logoutUser, 
  getOrCreateRootBoard, 
  addItemToBoard, 
  updateBoardItem, 
  removeItemFromBoard,
  getAllItemsFromBoard,
  uploadImageFile
} from '../../services/api';
import NoteCard from './NoteCard';
import Board from './Board';
import LineTool from './LineTool';
import ImageCard from './ImageCard';
import KeyboardShortcutWrapper from '../functional/KeyboardShortcutWrapper';
import { BoardLayout } from './BoardLayout';
import { getImageDimensions } from '../../utils/image';

import { SelectionBox } from './SelectionBox';
import { useSelection } from '../../hooks/useSelection';
import { useGroupMovement } from '../../hooks/useGroupMovement';
import { useZoom } from '../../hooks/useZoom';
import { useCanvasPan } from '../../hooks/useCanvasPan';
import { 
  ContentType, 
  CardData, 
  BoardData, 
  LineData, 
  SessionToken, 
  BoardItem 
} from '../../types/boardTypes';

const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024; // Align with backend 20MB limit

interface ImageData {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
  name?: string;
}


/**
 * RootBoard Component
 * 
 * A blank board with header and sidebar similar to Milanote.
 * Provides an infinite canvas workspace with navigation sidebar.
 * 
 * this board renders other baords. while also being a baord itself. 
 * simpley put by default it redners the efualt root baord. then if there are other baords
 * item in it and you click to navigate to a new board this board adopts the data of the new baord and 
 * loads it in. 
 */
export default function RootBoard() {
  const navigate = useNavigate();
  const { boardId: urlBoardId } = useParams<{ boardId?: string }>();
  const [noteCards, setCards] = useState<CardData[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [lines, setLines] = useState<LineData[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [rootBoardId, setRootBoardId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  // Use zoom hook
  const { zoom, updateZoom, resetZoom } = useZoom({
    initialZoom: 1,
    minZoom: 0.25,
    maxZoom: 3,
    step: 0.1,
    enableWheelZoom: true,
  });

  // Use canvas pan hook for middle mouse button panning
  useCanvasPan({
    canvasSelector: '[data-canvas="true"]',
    enabled: true,
  });
  
  // Track modifier keys for multi-select
  const modifierKeysRef = useRef<{ ctrlKey: boolean; shiftKey: boolean; metaKey: boolean }>({
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
  });

  // Track previous selectedIds to detect deselection
  const previousSelectedIdsRef = useRef<Set<string>>(new Set());
  
  // Refs to track latest state values for database updates
  const cardsRef = useRef<CardData[]>(noteCards);
  const boardsRef = useRef<BoardData[]>(boards);
  const linesRef = useRef<LineData[]>(lines);
  const imagesRef = useRef<ImageData[]>(images);
  
  // Use selection hook
  const {
    selectedIds,
    setSelectedIds,
    selectionBoxStart,
    selectionBoxEnd,
    isSelecting,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleItemClick: handleItemClickBase,
    justFinishedSelectingRef,
    justFinishedDraggingRef,
    handleItemMouseDown,
  } = useSelection({
    noteCards,
    boards,
    lines,
    images,
    zoom,
  });

  // Ref to track latest selectedIds to avoid stale closures
  const selectedIdsRef = useRef<Set<string>>(selectedIds);
  // Track if we're currently dragging to defer database saves until drag ends
  const isDraggingRef = useRef<boolean>(false);
  // Store pending position updates during drag
  const pendingPositionUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Update refs whenever state changes
  useEffect(() => {
    cardsRef.current = noteCards;
    selectedIdsRef.current = selectedIds;
  }, [noteCards, selectedIds]);
  
  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);
  
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Create unified items array (cards, boards, images) - only id, position, size
  const allItems = useMemo(() => [
    ...noteCards.map(c => ({ id: c.id, position: c.position, size: c.size })),
    ...boards.map(b => ({ id: b.id, position: b.position, size: { width: 150, height: 150 } })),
    ...images.map(img => ({ id: img.id, position: img.position, size: img.size })),
  ], [noteCards, boards, images]);

  // Unified update callback that routes to the correct setter
  const updateItem = useCallback((id: string, position: { x: number; y: number }) => {
    // Find which array contains this item and update accordingly
    const card = noteCards.find(c => c.id === id);
    if (card) {
      setCards(prevCards => prevCards.map(c => c.id === id ? { ...c, position } : c));
      return;
    }
    
    const board = boards.find(b => b.id === id);
    if (board) {
      setBoards(prevBoards => prevBoards.map(b => b.id === id ? { ...b, position } : b));
      return;
    }
    
    const image = images.find(img => img.id === id);
    if (image) {
      setImages(prevImages => prevImages.map(img => img.id === id ? { ...img, position } : img));
      return;
    }
  }, [noteCards, boards, images, setCards, setBoards, setImages]);

  // Line update callback
  const updateLine = useCallback((id: string, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) => {
    setLines(prevLines => prevLines.map(line => 
      line.id === id ? { ...line, startPoint, endPoint } : line
    ));
  }, [setLines]);

  // Use group movement hook for UI updates
  const {
    handleItemPositionChange: handleItemPositionChangeUI,
    handleLinePointsChange: handleLinePointsChangeUI,
    getLastFinalPositions,
  } = useGroupMovement({
    items: allItems,
    lines: lines.map(l => ({ id: l.id, startPoint: l.startPoint, endPoint: l.endPoint })),
    selectedIds,
    updateItem,
    updateLine,
  });


  // Get session token from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const authToken = localStorage.getItem('authToken');
    
    console.log('RootBoard: Checking auth state', { hasUser: !!userStr, hasAuthToken: !!authToken });
    
    // Check both user object and authToken to ensure user is logged in
    if (!userStr && !authToken) {
      // No user data at all, redirect to login
      console.warn('RootBoard: No user data found, redirecting to login');
      setIsLoading(false); // Stop loading before redirect
      navigate('/login');
      return;
    }
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('RootBoard: Parsed user object', { hasUid: !!(user.uid || user.UID), hasEmail: !!user.email });
        
        // Validate user object has required fields
        if (!user.uid && !user.UID) {
          console.warn('RootBoard: User object missing uid/UID, redirecting to login');
          setIsLoading(false); // Stop loading before redirect
          navigate('/login');
          return;
        }
        
        setSessionToken({
          email: user.email || '',
          displayName: user.displayName || 'User',
          UID: user.uid || user.UID || '',
        });
        
        // Check admin status
        const role = (user.role || localStorage.getItem("userRole") || "").toLowerCase();
        const storedAdminFlag = localStorage.getItem("isAdmin");
        const hasAdminPrivileges = Boolean(
          user.isAdmin ||
          role === "admin" ||
          storedAdminFlag === "true"
        );
        setIsAdmin(hasAdminPrivileges);
        console.log('RootBoard: Session token set, isAdmin:', hasAdminPrivileges);
      } catch (parseError) {
        console.error('RootBoard: Failed to parse user object:', parseError);
        setIsLoading(false); // Stop loading before redirect
        navigate('/login');
      }
    } else if (authToken) {
      // Have token but no user object - try to reconstruct from localStorage
      const uid = localStorage.getItem('userId');
      const email = localStorage.getItem('userEmail') || '';
      const displayName = localStorage.getItem('userDisplayName') || 'User';
      
      if (uid) {
        setSessionToken({
          email,
          displayName,
          UID: uid,
        });
        
        const role = (localStorage.getItem("userRole") || "").toLowerCase();
        const storedAdminFlag = localStorage.getItem("isAdmin");
        setIsAdmin(role === "admin" || storedAdminFlag === "true");
      } else {
        console.warn('RootBoard: Have authToken but no userId, redirecting to login');
        setIsLoading(false); // Stop loading before redirect
        navigate('/login');
      }
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
        setImages([]);
        setBoards([]);
        setLines([]);
        
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
            
            // Load image cards
            const loadedImages: ImageData[] = items
              .filter((item: BoardItem) => item.contentType === ContentType.IMG)
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
            
            // Load lines
            const loadedLines: LineData[] = items
              .filter((item: BoardItem) => item.contentType === ContentType.LINE)
              .map((item: BoardItem) => ({
                id: item.id,
                startPoint: {
                  x: Array.isArray(item.position) ? item.position[0] : 0,
                  y: Array.isArray(item.position) ? item.position[1] : 0,
                },
                endPoint: {
                  x: Array.isArray(item.size) ? item.size[0] : 100,
                  y: Array.isArray(item.size) ? item.size[1] : 100,
                },
              }));
            
            // Set cards, boards, lines, and images (will be empty arrays if no items)
            setCards(loadedCards);
            setImages(loadedImages);
            setBoards(loadedBoards);
            setLines(loadedLines);
          } else {
            // No items found, ensure empty state
            setCards([]);
            setImages([]);
            setBoards([]);
            setLines([]);
          }
        } catch (loadError: any) {
          // If loading items fails, clear state and show empty board
          console.warn('Failed to load existing items from board:', loadError);
          setCards([]);
          setImages([]);
          setBoards([]);
          setLines([]);
          
          // Only redirect on specific authentication errors (401, 403, or explicit auth messages)
          const isAuthError = 
            loadError?.message?.includes('No authentication token') ||
            loadError?.message?.includes('not authenticated') ||
            loadError?.message?.includes('Invalid ID token') ||
            loadError?.message?.includes('ID token has expired') ||
            (loadError?.response?.status === 401) ||
            (loadError?.response?.status === 403);
            
          if (isAuthError) {
            console.error('Authentication error, redirecting to login');
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            navigate('/login');
            return;
          }
        }
      } catch (error: any) {
        console.error('Failed to initialize board:', error);
        
        // Only redirect on specific authentication errors (401, 403, or explicit auth messages)
        const isAuthError = 
          error?.message?.includes('No authentication token') ||
          error?.message?.includes('not authenticated') ||
          error?.message?.includes('Invalid ID token') ||
          error?.message?.includes('ID token has expired') ||
          (error?.response?.status === 401) ||
          (error?.response?.status === 403);
          
        if (isAuthError) {
          console.error('Authentication error, redirecting to login');
          localStorage.removeItem('user');
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userId');
          navigate('/login');
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeBoard();
  }, [sessionToken, urlBoardId, navigate]);

  const handleSignOut = async () => {
    try {
      await logoutUser();
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      navigate('/login');
    } catch (error: any) {
      console.error('Failed to sign out:', error?.message || error);
    }
  };

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

  // Wrapper that combines UI updates (from hook) with database updates
  const handleCardPositionChange = async (id: string, position: { x: number; y: number }, mousePosition?: { x: number; y: number }) => {
    // Update UI using group movement hook
    handleItemPositionChangeUI(id, position, mousePosition);

    // Track drag state: if mousePosition is provided, we're during drag; if not, drag just ended
    if (mousePosition !== undefined) {
      // During drag - just update UI, don't save to database yet
      isDraggingRef.current = true;
      pendingPositionUpdatesRef.current.set(id, position);
      return;
    }

    // Drag ended (mousePosition is undefined) - save to database
    isDraggingRef.current = false;
    const finalPosition = position;

    // Use ref to get latest selectedIds to avoid stale closures
    const currentSelectedIds = selectedIdsRef.current;
    
    // Update database for single item movement
    // If item is NOT selected OR only one item is selected (including this one), update database immediately
    // For group movement (multiple items selected including this one), database updates happen on deselection
    const isSingleItemOrNotSelected = currentSelectedIds.size === 0 || 
                                      currentSelectedIds.size === 1 || 
                                      !currentSelectedIds.has(id);
    
    if (isSingleItemOrNotSelected) {
      if (!currentBoardId || !sessionToken) return;
      
      try {
        await updateBoardItem(
          currentBoardId,
          sessionToken,
          id,
          { position: [finalPosition.x, finalPosition.y] }
        );
        console.log(`Saved card ${id} position to database:`, finalPosition);
      } catch (error: any) {
        console.error('Failed to update card position:', error);
      }
    } else {
      // Group movement - save all selected items to database immediately when drag ends
      // Get final positions from finalizeGroupMovement (calculated before React state updates)
      const finalPositions = getLastFinalPositions();
      console.log(`Card ${id} is part of group movement (${currentSelectedIds.size} items), saving all to database`);
      if (finalPositions) {
        await saveSelectedItemsToDatabase(currentSelectedIds, finalPositions);
      } else {
        // Fallback: wait a bit for React state to update, then save
        setTimeout(async () => {
          await saveSelectedItemsToDatabase(currentSelectedIds);
        }, 0);
      }
      // Keep items selected after drag - only deselect on canvas click
    }
    
    // Clear pending update for this item
    pendingPositionUpdatesRef.current.delete(id);
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

  // Track modifier keys globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      modifierKeysRef.current.ctrlKey = e.ctrlKey;
      modifierKeysRef.current.shiftKey = e.shiftKey;
      modifierKeysRef.current.metaKey = e.metaKey;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      modifierKeysRef.current.ctrlKey = e.ctrlKey;
      modifierKeysRef.current.shiftKey = e.shiftKey;
      modifierKeysRef.current.metaKey = e.metaKey;
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      modifierKeysRef.current.ctrlKey = e.ctrlKey;
      modifierKeysRef.current.shiftKey = e.shiftKey;
      modifierKeysRef.current.metaKey = e.metaKey;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Wrapper for item click that uses modifier keys from ref
  const handleItemClick = useCallback((id: string) => {
    // Don't handle clicks if we just finished dragging - preserve the selection
    if (justFinishedDraggingRef.current) {
      return;
    }
    
    const { ctrlKey, shiftKey, metaKey } = modifierKeysRef.current;
    handleItemClickBase(id, ctrlKey, shiftKey, metaKey);
  }, [handleItemClickBase, justFinishedDraggingRef]);

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

  const handleSpawnImage = (position: { x: number; y: number }) => {
    if (!currentBoardId || !sessionToken) return;
    imageUploadPositionRef.current = position;
    if (imageUploadInputRef.current) {
      imageUploadInputRef.current.value = '';
      imageUploadInputRef.current.click();
    }
  };

  const handleImageFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentBoardId || !sessionToken) {
      event.target.value = '';
      imageUploadPositionRef.current = null;
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      imageUploadPositionRef.current = null;
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      alert(`Image is too large. Please choose a file smaller than ${Math.round(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB.`);
      event.target.value = '';
      imageUploadPositionRef.current = null;
      return;
    }

    const position = imageUploadPositionRef.current ?? { x: 100, y: 100 };
    let previewUrl: string | null = null;

    try {
      previewUrl = URL.createObjectURL(file);
      const { width: naturalWidth, height: naturalHeight } = await getImageDimensions(previewUrl);
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;

      const maxWidth = 420;
      const minWidth = 150;
      const minHeight = 120;

      const ratio = naturalWidth > 0 ? naturalHeight / naturalWidth : 1;
      let width = naturalWidth;
      let height = naturalHeight || minHeight;

      if (!width || !height) {
        width = 320;
        height = 240;
      }

      if (width > maxWidth) {
        width = maxWidth;
        height = Math.max(minHeight, Math.round(maxWidth * (ratio || 1)));
      }

      width = Math.max(minWidth, Math.round(width));
      height = Math.max(minHeight, Math.round(height));

      const uploadResult = await uploadImageFile(file);
      if (!uploadResult.url) {
        throw new Error('Upload succeeded but no URL was returned');
      }

      const result = await addItemToBoard(
        {
          content: uploadResult.url,
          contentType: ContentType.IMG,
          position: [position.x, position.y],
          size: [width, height],
        },
        sessionToken,
        currentBoardId,
        [position.x, position.y]
      );

      if (!result.itemId || typeof result.itemId !== 'string') {
        throw new Error('Invalid itemId received from server');
      }

      const trimmedId = result.itemId.trim();
      if (!trimmedId) {
        throw new Error('Item ID is empty after trimming');
      }

      const newImage: ImageData = {
        id: trimmedId,
        position,
        size: { width, height },
        content: uploadResult.url,
        name: file.name,
      };

      setImages(prevImages => [...prevImages, newImage]);
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      alert(`Failed to upload image: ${error.message || 'Unknown error'}`);
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      event.target.value = '';
      imageUploadPositionRef.current = null;
    }
  };

  const handleImagePositionChange = async (id: string, position: { x: number; y: number }, mousePosition?: { x: number; y: number }) => {
    // Update UI immediately via group movement hook
    handleItemPositionChangeUI(id, position, mousePosition);

    // Track drag state: if mousePosition is provided, we're during drag; if not, drag just ended
    if (mousePosition !== undefined) {
      // During drag - just update UI, don't save to database yet
      isDraggingRef.current = true;
      pendingPositionUpdatesRef.current.set(id, position);
      return;
    }

    // Drag ended (mousePosition is undefined) - save to database
    isDraggingRef.current = false;
    const finalPosition = position;

    // Use ref to get latest selectedIds to avoid stale closures
    const currentSelectedIds = selectedIdsRef.current;
    
    // Update database for single item movement
    // If item is NOT selected OR only one item is selected (including this one), update database immediately
    // For group movement (multiple items selected including this one), database updates happen on deselection
    const isSingleItemOrNotSelected = currentSelectedIds.size === 0 || 
                                      currentSelectedIds.size === 1 || 
                                      !currentSelectedIds.has(id);
    
    if (isSingleItemOrNotSelected) {
      if (!currentBoardId || !sessionToken) return;
      
      try {
        await updateBoardItem(
          currentBoardId,
          sessionToken,
          id,
          { position: [finalPosition.x, finalPosition.y] }
        );
        console.log(`Saved image ${id} position to database:`, finalPosition);
      } catch (error: any) {
        console.error('Failed to update image position:', error);
      }
    } else {
      // Group movement - save all selected items to database immediately when drag ends
      // Get final positions from finalizeGroupMovement (calculated before React state updates)
      const finalPositions = getLastFinalPositions();
      console.log(`Image ${id} is part of group movement (${currentSelectedIds.size} items), saving all to database`);
      if (finalPositions) {
        await saveSelectedItemsToDatabase(currentSelectedIds, finalPositions);
      } else {
        // Fallback: wait a bit for React state to update, then save
        setTimeout(async () => {
          await saveSelectedItemsToDatabase(currentSelectedIds);
        }, 0);
      }
      // Keep items selected after drag - only deselect on canvas click
    }
    
    // Clear pending update for this item
    pendingPositionUpdatesRef.current.delete(id);
  };

  const handleImageSizeChange = async (id: string, size: { width: number; height: number }) => {
    setImages(prevImages => prevImages.map(image => 
      image.id === id ? { ...image, size } : image
    ));

    if (!currentBoardId || !sessionToken) return;

    try {
      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { size: [size.width, size.height] }
      );
    } catch (error: any) {
      console.error('Failed to update image size:', error);
    }
  };

  const handleImageDelete = async (id: string) => {
    if (!currentBoardId || !sessionToken) return;

    let imageToDelete: ImageData | undefined;
    setImages(prevImages => {
      imageToDelete = prevImages.find(image => image.id === id);
      return prevImages.filter(image => image.id !== id);
    });

    try {
      await removeItemFromBoard(
        { id, contentType: ContentType.IMG },
        sessionToken,
        currentBoardId
      );
    } catch (error: any) {
      console.error('Failed to delete image from database:', error);
      if (imageToDelete) {
        setImages(prevImages => [...prevImages, imageToDelete!]);
      }
    }
  };

  const handleImageReplace = async (id: string, file: File) => {
    if (!currentBoardId || !sessionToken) return;

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      alert(`Image is too large. Please choose a file smaller than ${Math.round(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB.`);
      return;
    }

    const previousContent = images.find(image => image.id === id)?.content;

    try {
      const uploadResult = await uploadImageFile(file);
      if (!uploadResult.url) {
        throw new Error('Upload succeeded but no URL was returned');
      }

      setImages(prevImages => prevImages.map(image => 
        image.id === id ? { ...image, content: uploadResult.url, name: file.name } : image
      ));

      await updateBoardItem(
        currentBoardId,
        sessionToken,
        id,
        { content: uploadResult.url }
      );
    } catch (error: any) {
      console.error('Failed to update image content:', error);
      if (previousContent !== undefined) {
        const fallback = previousContent;
        setImages(prevImages => prevImages.map(image => 
          image.id === id ? { ...image, content: fallback } : image
        ));
      }
      alert(`Failed to replace image: ${error.message || 'Unknown error'}`);
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

  // Wrapper that combines UI updates (from hook) with database updates
  const handleBoardPositionChange = async (id: string, position: { x: number; y: number }, mousePosition?: { x: number; y: number }) => {
    // Update UI using group movement hook
    handleItemPositionChangeUI(id, position, mousePosition);

    // Track drag state: if mousePosition is provided, we're during drag; if not, drag just ended
    if (mousePosition !== undefined) {
      // During drag - just update UI, don't save to database yet
      isDraggingRef.current = true;
      pendingPositionUpdatesRef.current.set(id, position);
      return;
    }

    // Drag ended (mousePosition is undefined) - save to database
    isDraggingRef.current = false;
    const finalPosition = position;

    // Use ref to get latest selectedIds to avoid stale closures
    const currentSelectedIds = selectedIdsRef.current;
    
    // Update database for single item movement (group movement updates are throttled)
    if (currentSelectedIds.size <= 1 || !currentSelectedIds.has(id)) {
      if (!currentBoardId || !sessionToken) return;
      
      try {
        await updateBoardItem(
          currentBoardId,
          sessionToken,
          id,
          { position: [finalPosition.x, finalPosition.y] }
        );
      } catch (error: any) {
        console.error('Failed to update board position:', error);
      }
    } else {
      // Group movement - save all selected items to database immediately when drag ends
      // Get final positions from finalizeGroupMovement (calculated before React state updates)
      const finalPositions = getLastFinalPositions();
      console.log(`Board ${id} is part of group movement (${currentSelectedIds.size} items), saving all to database`);
      if (finalPositions) {
        await saveSelectedItemsToDatabase(currentSelectedIds, finalPositions);
      } else {
        // Fallback: wait a bit for React state to update, then save
        setTimeout(async () => {
          await saveSelectedItemsToDatabase(currentSelectedIds);
        }, 0);
      }
      // Keep items selected after drag - only deselect on canvas click
    }
    
    // Clear pending update for this item
    pendingPositionUpdatesRef.current.delete(id);
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

  // Line handlers
  const handleSpawnLine = async (position: { x: number; y: number }) => {
    if (!currentBoardId || !sessionToken) return;

    console.log('Adding line to board:', currentBoardId);

    // Create line with default endpoints (start at click position, end 100px to the right)
    const startPoint = position;
    const endPoint = { x: position.x + 100, y: position.y };

    try {
      const result = await addItemToBoard(
        {
          content: '', // Can store line metadata (color, strokeWidth) as JSON if needed
          contentType: ContentType.LINE,
          position: [startPoint.x, startPoint.y],
          size: [endPoint.x, endPoint.y], // Store end point in size array
        },
        sessionToken,
        currentBoardId,
        [position.x, position.y]
      );
      
      if (!result.itemId || typeof result.itemId !== 'string') {
        throw new Error('Invalid itemId received from server');
      }
      
      const trimmedId = result.itemId.trim();
      if (!trimmedId) {
        throw new Error('Item ID is empty after trimming');
      }
      
      const newLine: LineData = {
        id: trimmedId,
        startPoint,
        endPoint,
      };
      
      console.log('Creating line with ID:', newLine.id);
      setLines(prevLines => [...prevLines, newLine]);
    } catch (error: any) {
      console.error('Failed to create line in database:', error);
      alert(`Failed to create line: ${error.message || 'Unknown error'}`);
    }
  };

  // Wrapper that combines UI updates (from hook) with database updates
  const handleLinePointsChange = async (
    id: string,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    mousePosition?: { x: number; y: number }
  ) => {
    // Update UI using group movement hook
    handleLinePointsChangeUI(id, startPoint, endPoint, mousePosition);

    // Track drag state: if mousePosition is provided, we're during drag; if not, drag just ended
    if (mousePosition !== undefined) {
      // During drag - just update UI, don't save to database yet
      return;
    }

    // Drag ended (mousePosition is undefined) - save to database
    // Use ref to get latest selectedIds to avoid stale closures
    const currentSelectedIds = selectedIdsRef.current;
    
    // Update database for single item movement
    if (currentSelectedIds.size <= 1 || !currentSelectedIds.has(id)) {
      if (!currentBoardId || !sessionToken) return;
      
      try {
        await updateBoardItem(
          currentBoardId,
          sessionToken,
          id,
          {
            position: [startPoint.x, startPoint.y],
            size: [endPoint.x, endPoint.y], // Store end point in size array
          }
        );
      } catch (error: any) {
        console.error('Failed to update line points:', error);
      }
    } else {
      // Group movement - save all selected items to database immediately when drag ends
      // Get final positions from finalizeGroupMovement (calculated before React state updates)
      const finalPositions = getLastFinalPositions();
      console.log(`Line ${id} is part of group movement (${currentSelectedIds.size} items), saving all to database`);
      if (finalPositions) {
        await saveSelectedItemsToDatabase(currentSelectedIds, finalPositions);
      } else {
        // Fallback: wait a bit for React state to update, then save
        setTimeout(async () => {
          await saveSelectedItemsToDatabase(currentSelectedIds);
        }, 0);
      }
      // Keep items selected after drag - only deselect on canvas click
    }
  };

  const handleLineDelete = async (id: string) => {
    if (!currentBoardId || !sessionToken) return;

    // Optimistically remove from UI
    let lineToDelete: LineData | undefined;
    setLines(prevLines => {
      lineToDelete = prevLines.find(line => line.id === id);
      return prevLines.filter(line => line.id !== id);
    });

    // Delete from database
    try {
      await removeItemFromBoard(
        { id, contentType: ContentType.LINE },
        sessionToken,
        currentBoardId
      );
    } catch (error: any) {
      console.error('Failed to delete line from database:', error);
      // Revert optimistic update on error
      if (lineToDelete) {
        setLines(prevLines => [...prevLines, lineToDelete!]);
      }
    }
  };

  // Single item delete handler (takes an id parameter)
  const handleDeleteSelected = async (id: string) => {
    // Check if it's a card, board, image, or line
    const isCard = noteCards.some(card => card.id === id);
    const isImage = images.some(image => image.id === id);
    const isLine = lines.some(line => line.id === id);
    if (isCard) {
      await handleCardDelete(id);
    } else if (isImage) {
      await handleImageDelete(id);
    } else if (isLine) {
      await handleLineDelete(id);
    } else {
      await handleBoardDelete(id);
    }
  };

  // Unified delete handler for keyboard shortcuts (works with multi-select)
  const handleDeleteSelectedMultiple = async () => {
    if (selectedIds.size === 0) return;
    
    // Delete all selected items
    const deletePromises = Array.from(selectedIds).map(async (id) => {
      const isCard = noteCards.some(card => card.id === id);
      const isImage = images.some(image => image.id === id);
      const isLine = lines.some(line => line.id === id);
      if (isCard) {
        await handleCardDelete(id);
      } else if (isImage) {
        await handleImageDelete(id);
      } else if (isLine) {
        await handleLineDelete(id);
      } else {
        await handleBoardDelete(id);
      }
    });
    
    await Promise.all(deletePromises);
    setSelectedIds(new Set()); // Clear selection after deletion
  };

  // Save selected items to database when deselection occurs (after group movement)
  // If finalPositions are provided, use those instead of reading from refs (for immediate save after drag)
  const saveSelectedItemsToDatabase = useCallback(async (
    idsToSave: Set<string>,
    finalPositions?: { itemPositions: Map<string, { x: number; y: number }>; linePositions: Map<string, { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }> }
  ) => {
    if (!currentBoardId || !sessionToken || idsToSave.size === 0) return;

    // Collect all items that need to be saved
    const updatePromises: Promise<void>[] = [];

    // If finalPositions are provided, use those (from finalizeGroupMovement)
    if (finalPositions) {
      // Update items using final positions
      finalPositions.itemPositions.forEach((position, id) => {
        if (idsToSave.has(id)) {
          updatePromises.push(
            updateBoardItem(
              currentBoardId!,
              sessionToken!,
              id,
              { position: [position.x, position.y] }
            ).catch(err => console.error(`Failed to update item ${id}:`, err))
          );
        }
      });

      // Update lines using final positions
      finalPositions.linePositions.forEach((linePos, id) => {
        if (idsToSave.has(id)) {
          updatePromises.push(
            updateBoardItem(
              currentBoardId!,
              sessionToken!,
              id,
              {
                position: [linePos.startPoint.x, linePos.startPoint.y],
                size: [linePos.endPoint.x, linePos.endPoint.y],
              }
            ).catch(err => console.error(`Failed to update line ${id}:`, err))
          );
        }
      });
    } else {
      // Fallback: use refs to get latest state (for deselection saves)
      // Update cards
      cardsRef.current.forEach(card => {
      if (idsToSave.has(card.id)) {
        updatePromises.push(
          updateBoardItem(
            currentBoardId!,
            sessionToken!,
            card.id,
            { position: [card.position.x, card.position.y] }
          ).catch(err => console.error(`Failed to update card ${card.id}:`, err))
        );
      }
      });

      // Update boards
      boardsRef.current.forEach(board => {
      if (idsToSave.has(board.id)) {
        updatePromises.push(
          updateBoardItem(
            currentBoardId!,
            sessionToken!,
            board.id,
            { position: [board.position.x, board.position.y] }
          ).catch(err => console.error(`Failed to update board ${board.id}:`, err))
        );
      }
      });

      // Update images
      imagesRef.current.forEach(image => {
      if (idsToSave.has(image.id)) {
        updatePromises.push(
          updateBoardItem(
            currentBoardId!,
            sessionToken!,
            image.id,
            { position: [image.position.x, image.position.y] }
          ).catch(err => console.error(`Failed to update image ${image.id}:`, err))
        );
      }
      });

      // Update lines
      linesRef.current.forEach(line => {
      if (idsToSave.has(line.id)) {
        updatePromises.push(
          updateBoardItem(
            currentBoardId!,
            sessionToken!,
            line.id,
            {
              position: [line.startPoint.x, line.startPoint.y],
              size: [line.endPoint.x, line.endPoint.y],
            }
          ).catch(err => console.error(`Failed to update line ${line.id}:`, err))
        );
      }
      });
    }

    // Execute all updates in parallel
    await Promise.all(updatePromises).catch(err => 
      console.error('Error updating group positions:', err)
    );
  }, [currentBoardId, sessionToken]);

  // Detect deselection and save positions to database
  useEffect(() => {
    const previousSize = previousSelectedIdsRef.current.size;
    const currentSize = selectedIds.size;

    // If we had multiple items selected and now have fewer (deselection occurred)
    if (previousSize > 1 && currentSize < previousSize) {
      // Save the positions of the items that were previously selected
      saveSelectedItemsToDatabase(previousSelectedIdsRef.current);
    }

    // Update the ref for next comparison
    previousSelectedIdsRef.current = new Set(selectedIds);
  }, [selectedIds, saveSelectedItemsToDatabase]);

  // Show loading state while initializing
  if (isLoading && !sessionToken) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <input
      type="file"
      accept="image/*"
      ref={imageUploadInputRef}
      className="hidden"
      onChange={handleImageFileInputChange}
    />
    <BoardLayout
      onSpawnCard={handleSpawnCard}
      onSpawnBoard={handleSpawnBoard}
      onSpawnLine={handleSpawnLine}
      onSpawnImage={handleSpawnImage}
      onSignOut={handleSignOut}
      zoom={zoom}
      onZoomChange={updateZoom}
      onZoomReset={resetZoom}
      isAdmin={isAdmin}
    >
      {/* Canvas Area */}
      <div 
        className="h-full w-full overflow-auto bg-gray-50" 
        data-canvas="true"
        style={{ cursor: 'default' }}
          onClick={(e) => {
            console.log('[rootBoard] Canvas onClick (outer)', {
              justFinishedSelecting: justFinishedSelectingRef.current,
              justFinishedDragging: justFinishedDraggingRef.current,
              target: (e.target as HTMLElement).tagName,
              currentTarget: (e.currentTarget as HTMLElement).tagName
            });
            
            // Don't clear selection if we just finished a selection box operation or dragging
            if (justFinishedSelectingRef.current || justFinishedDraggingRef.current) {
              console.log('[rootBoard] Canvas onClick BLOCKED - just finished selecting/dragging');
              return;
            }
            
            // Clear selection when clicking on the main canvas background
            const target = e.target as HTMLElement;
            const isClickingOnItem = target.closest('[data-card]') || 
                                    target.closest('[data-board]') || 
                                    target.closest('[data-line]') ||
                                    target.closest('[data-image]');
            
            console.log('[rootBoard] Canvas onClick check', {
              isClickingOnItem: !!isClickingOnItem,
              targetClasses: target.className
            });
            
            // If clicking on the main element or its direct children (not on an item), clear selection
            if (!isClickingOnItem) {
              // Check if we're clicking on the main element, keyboard wrapper, or the relative div
              const isBackground = 
                target === e.currentTarget ||
                target.classList.contains('keyboard-shortcut-wrapper') ||
                (target.classList.contains('relative') && 
                 !target.closest('[data-card]') && 
                 !target.closest('[data-board]') && 
                 !target.closest('[data-line]') &&
                 !target.closest('[data-image]'));
              
              if (isBackground) {
                console.log('[rootBoard] CLEARING SELECTION - canvas background click');
                setSelectedIds(new Set());
              }
            }
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <KeyboardShortcutWrapper
            selectedId={Array.from(selectedIds)[0] || null}
            onDelete={handleDeleteSelected}
            enabled={!isLoading}
          >
          <div 
            className="relative min-h-full min-w-full p-24"
            style={{ minHeight: 'calc(100vh + 400px)', minWidth: 'calc(100vw + 400px)' }}
            onClick={(e) => {
              console.log('[rootBoard] Canvas onClick (middle)', {
                justFinishedSelecting: justFinishedSelectingRef.current,
                justFinishedDragging: justFinishedDraggingRef.current,
                isSelecting,
                target: (e.target as HTMLElement).tagName
              });
              
              // Don't clear selection if we just finished a selection box operation or dragging
              if (justFinishedSelectingRef.current || justFinishedDraggingRef.current) {
                console.log('[rootBoard] Canvas onClick (middle) BLOCKED - just finished selecting/dragging');
                return;
              }
              
              // Clear selection when clicking on the canvas background (not on a card/board/line)
              const target = e.target as HTMLElement;
              const isClickingOnItem = target.closest('[data-card]') || 
                                      target.closest('[data-board]') || 
                                      target.closest('[data-line]') ||
                                      target.closest('[data-image]');
              
              console.log('[rootBoard] Canvas onClick (middle) check', {
                isClickingOnItem: !!isClickingOnItem,
                isSelecting
              });
              
              // If clicking on the canvas background (this div or empty state), clear selection
              if (!isClickingOnItem && !isSelecting) {
                console.log('[rootBoard] CLEARING SELECTION - canvas background click (middle)');
                setSelectedIds(new Set());
              }
            }}
          >
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

            {/* Cards, Boards, Lines, and Images Container */}
            {!isLoading && (noteCards.length > 0 || boards.length > 0 || lines.length > 0 || images.length > 0) && (
              <div 
                className="absolute inset-0 p-24 origin-top-left"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: '0 0',
                  transition: 'transform 0.15s ease-out',
                }}
                onClick={(e) => {
                  console.log('[rootBoard] Canvas onClick (inner)', {
                    justFinishedSelecting: justFinishedSelectingRef.current,
                    justFinishedDragging: justFinishedDraggingRef.current,
                    isSelecting,
                    target: (e.target as HTMLElement).tagName
                  });
                  
                  // Don't clear selection if we just finished a selection box operation or dragging
                  if (justFinishedSelectingRef.current || justFinishedDraggingRef.current) {
                    console.log('[rootBoard] Canvas onClick (inner) BLOCKED - just finished selecting/dragging');
                    return;
                  }
                  
                  // Clear selection when clicking on the container background (not on a card/board/line)
                  const target = e.target as HTMLElement;
                  const isClickingOnItem = target.closest('[data-card]') || 
                                          target.closest('[data-board]') || 
                                          target.closest('[data-line]') ||
                                          target.closest('[data-image]');
                  
                  console.log('[rootBoard] Canvas onClick (inner) check', {
                    isClickingOnItem: !!isClickingOnItem,
                    isSelecting
                  });
                  
                  // If clicking on the container itself (not on an item inside it), clear selection
                  if (!isClickingOnItem && !isSelecting) {
                    console.log('[rootBoard] CLEARING SELECTION - canvas background click (inner)');
                    setSelectedIds(new Set());
                  }
                }}
              >
                {/* Selection Box - Inside zoomed container so it scales with items */}
                <SelectionBox 
                  start={selectionBoxStart} 
                  end={selectionBoxEnd} 
                  zoom={1} 
                />
                {noteCards.map(card => (
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
                    onClick={() => {
                      // Prevent onClick if we just finished dragging
                      if (!justFinishedDraggingRef.current) {
                        handleItemClick(card.id);
                      }
                    }}
                    isSelected={selectedIds.has(card.id)}
                    zoom={zoom}
                  />
                ))}
                {images.map(image => (
                  <ImageCard
                    key={image.id}
                    id={image.id}
                    src={image.content}
                    initialPosition={image.position}
                    initialSize={image.size}
                    onPositionChange={handleImagePositionChange}
                    onSizeChange={handleImageSizeChange}
                    onReplaceImage={handleImageReplace}
                    onDelete={handleImageDelete}
                    onClick={() => {
                      // Prevent onClick if we just finished dragging
                      if (!justFinishedDraggingRef.current) {
                        handleItemClick(image.id);
                      }
                    }}
                    isSelected={selectedIds.has(image.id)}
                    altText={image.name || 'Board image'}
                    onMouseDown={handleItemMouseDown}
                    zoom={zoom}
                  />
                ))}
                {boards.map(board => (
                  <Board
                    key={board.id}
                    id={board.id}
                    initialPosition={board.position}
                    initialTitle={board.title}
                    cardCount={board.cardCount ?? 0}
                    zoom={zoom}
                    onPositionChange={handleBoardPositionChange}
                    onTitleChange={handleBoardTitleChange}
                    onTitleBlur={handleBoardTitleBlur}
                    onDelete={handleBoardDelete}
                    onClick={(id) => {
                      // Prevent onClick if we just finished dragging
                      if (!justFinishedDraggingRef.current) {
                        handleItemClick(id);
                      }
                    }}
                    onDoubleClick={handleBoardClick}
                    isSelected={selectedIds.has(board.id)}
                    onMouseDown={handleItemMouseDown}
                  />
                ))}
                {lines.map(line => (
                  <LineTool
                    key={line.id}
                    id={line.id}
                    initialStartPoint={line.startPoint}
                    initialEndPoint={line.endPoint}
                    onPointsChange={handleLinePointsChange}
                    onDelete={handleLineDelete}
                    onClick={() => {
                      // Prevent onClick if we just finished dragging
                      if (!justFinishedDraggingRef.current) {
                        handleItemClick(line.id);
                      }
                    }}
                    isSelected={selectedIds.has(line.id)}
                    onMouseDown={handleItemMouseDown}
                  />
                ))}
              </div>
            )}

            {/* Empty State - Only show if no cards/boards/lines and not loading */}
            {!isLoading && noteCards.length === 0 && boards.length === 0 && lines.length === 0 && images.length === 0 && (
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
          </KeyboardShortcutWrapper>
      </div>
    </BoardLayout>
    </>
  );
}
