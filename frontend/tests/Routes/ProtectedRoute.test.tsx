import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '../../src/Routes/ProtectedRoute';

// Mock child component for testing
const MockChild = () => <div>Protected Content</div>;

// Helper to render ProtectedRoute with router
const renderProtectedRoute = (userInStorage: string | null = null) => {
  // Clear localStorage first
  localStorage.clear();
  
  // Set user in localStorage if provided
  if (userInStorage !== null) {
    localStorage.setItem('user', userInStorage);
  }
  
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <ProtectedRoute>
        <MockChild />
      </ProtectedRoute>
    </MemoryRouter>
  );
};

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('User Authentication', () => {
    it('renders children when user exists in localStorage with valid data', () => {
      const validUser = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test User'
      });
      
      renderProtectedRoute(validUser);
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('renders children when user exists with only required fields (uid and email)', () => {
      const minimalUser = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com'
      });
      
      renderProtectedRoute(minimalUser);
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('redirects to /login when user does not exist in localStorage', () => {
      renderProtectedRoute(null);
      
      // Navigate component should redirect, so child should not be visible
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when localStorage.getItem returns null', () => {
      // Explicitly set to null (though clear() already does this)
      localStorage.clear();
      
      renderProtectedRoute(null);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Invalid User Data', () => {
    it('redirects to /login when user data is missing uid', () => {
      const invalidUser = JSON.stringify({
        email: 'test@example.com',
        displayName: 'Test User'
      });
      
      renderProtectedRoute(invalidUser);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when user data is missing email', () => {
      const invalidUser = JSON.stringify({
        uid: 'test-uid',
        displayName: 'Test User'
      });
      
      renderProtectedRoute(invalidUser);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when user data is empty object', () => {
      const emptyUser = JSON.stringify({});
      
      renderProtectedRoute(emptyUser);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when user data is null', () => {
      const nullUser = JSON.stringify(null);
      
      renderProtectedRoute(nullUser);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when localStorage contains invalid JSON', () => {
      // Set invalid JSON string
      localStorage.setItem('user', 'invalid-json-{');
      
      renderProtectedRoute('invalid-json-{');
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('redirects to /login when localStorage contains non-JSON string', () => {
      localStorage.setItem('user', 'not-json-at-all');
      
      renderProtectedRoute('not-json-at-all');
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles localStorage.getItem throwing an error gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });
      
      renderProtectedRoute(null);
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      
      // Restore original
      localStorage.getItem = originalGetItem;
    });

    it('handles JSON.parse throwing an error gracefully', () => {
      // Set a value that will cause JSON.parse to throw
      localStorage.setItem('user', '{"invalid": json}');
      
      renderProtectedRoute('{"invalid": json}');
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('allows displayName to be optional', () => {
      const userWithoutDisplayName = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com'
      });
      
      renderProtectedRoute(userWithoutDisplayName);
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('allows displayName to be null', () => {
      const userWithNullDisplayName = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: null
      });
      
      renderProtectedRoute(userWithNullDisplayName);
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('allows displayName to be empty string', () => {
      const userWithEmptyDisplayName = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: ''
      });
      
      renderProtectedRoute(userWithEmptyDisplayName);
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    it('renders the exact children passed to it when authenticated', () => {
      const validUser = JSON.stringify({
        uid: 'test-uid',
        email: 'test@example.com'
      });
      
      const CustomChild = () => <div data-testid="custom-child">Custom Protected Content</div>;
      
      localStorage.setItem('user', validUser);
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <CustomChild />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
      expect(screen.getByText('Custom Protected Content')).toBeInTheDocument();
    });

    it('does not render children when not authenticated', () => {
      const CustomChild = () => <div data-testid="custom-child">Custom Protected Content</div>;
      
      localStorage.clear();
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <CustomChild />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.queryByTestId('custom-child')).not.toBeInTheDocument();
    });
  });
});

