import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAllItemsFromBoard, API_URL } from '../../src/services/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('getAllItemsFromBoard', () => {
  const mockBoardId = 'board-123';
  const mockSessionToken = {
    email: 'test@example.com',
    displayName: 'Test User',
    UID: 'user-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    // Suppress console.log for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should fetch all items from a board successfully', async () => {
    const mockItems = [
      {
        id: 'item-1',
        content: 'Content 1',
        contentType: 'text',
        position: [100, 200],
        size: [256, 200]
      },
      {
        id: 'item-2',
        content: 'Content 2',
        contentType: 'text',
        position: [300, 400],
        size: [256, 200]
      }
    ];

    const mockResponse = {
      message: 'Items retrieved successfully',
      items: mockItems
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockResponse
    });

    const result = await getAllItemsFromBoard(mockBoardId, mockSessionToken);

    expect(result).toEqual(mockItems);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${API_URL}/items/get-all-items?boardId=${mockBoardId}`),
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.stringify(mockSessionToken)}`
        }
      })
    );
  });

  it('should throw error when response is not ok (404)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Board not found' })
    });

    await expect(
      getAllItemsFromBoard(mockBoardId, mockSessionToken)
    ).rejects.toThrow('Board not found');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error when response is not ok (500)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Internal server error' })
    });

    await expect(
      getAllItemsFromBoard(mockBoardId, mockSessionToken)
    ).rejects.toThrow('Internal server error');
  });

  it('should throw error when response JSON parsing fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    await expect(
      getAllItemsFromBoard(mockBoardId, mockSessionToken)
    ).rejects.toThrow('Failed to get all items: 500 - Internal Server Error');
  });

  it('should include boardId in query parameters', async () => {
    const mockItems: any[] = [];
    const mockResponse = {
      message: 'Items retrieved successfully',
      items: mockItems
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    await getAllItemsFromBoard(mockBoardId, mockSessionToken);

    const fetchCall = mockFetch.mock.calls[0];
    const url = fetchCall[0];
    expect(url).toContain(`boardId=${mockBoardId}`);
  });

  it('should correctly format Authorization header with session token', async () => {
    const mockItems: any[] = [];
    const mockResponse = {
      message: 'Items retrieved successfully',
      items: mockItems
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    await getAllItemsFromBoard(mockBoardId, mockSessionToken);

    const fetchCall = mockFetch.mock.calls[0];
    const options = fetchCall[1];
    expect(options.headers.Authorization).toBe(`Bearer ${JSON.stringify(mockSessionToken)}`);
  });

  it('should return empty array when board has no items', async () => {
    const mockResponse = {
      message: 'Items retrieved successfully',
      items: []
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getAllItemsFromBoard(mockBoardId, mockSessionToken);

    expect(result).toEqual([]);
  });

  it('should handle items with different content types', async () => {
    const mockItems = [
      {
        id: 'item-1',
        content: 'Text content',
        contentType: 'text',
        position: [100, 200],
        size: [256, 200]
      },
      {
        id: 'item-2',
        content: '<div>HTML content</div>',
        contentType: 'html',
        position: [300, 400],
        size: [400, 300]
      },
      {
        id: 'item-3',
        content: 'image-url.jpg',
        contentType: 'img',
        position: [500, 600],
        size: [600, 400]
      }
    ];

    const mockResponse = {
      message: 'Items retrieved successfully',
      items: mockItems
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await getAllItemsFromBoard(mockBoardId, mockSessionToken);

    expect(result).toEqual(mockItems);
    expect(result.length).toBe(3);
    expect(result[0].contentType).toBe('text');
    expect(result[1].contentType).toBe('html');
    expect(result[2].contentType).toBe('img');
  });
});

