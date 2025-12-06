/**
 * Error Page Integration - Usage Examples
 * 
 * This file demonstrates how to use the 404 and 500 error pages
 * in your React application.
 */

import { useNavigate } from 'react-router-dom';
import { navigateTo500, navigateTo404 } from '../utils/errorNavigation';
import ErrorBoundary from '../components/ErrorBoundary';

// ============================================
// Example 1: Using Error Boundary (Recommended)
// ============================================

/**
 * Wrap your entire app or specific routes with ErrorBoundary
 * to automatically catch and display errors
 */
export function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <YourAppContent />
    </ErrorBoundary>
  );
}

// ============================================
// Example 2: Manual Navigation to 500 Error
// ============================================

/**
 * Navigate to 500 page when catching errors in async operations
 */
export function ComponentWithErrorHandling() {
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      // Navigate to 500 error page with error details
      navigateTo500(navigate, error as Error);
    }
  };

  return <div>Your component</div>;
}

// ============================================
// Example 3: Manual Navigation to 404 Error
// ============================================

/**
 * Navigate to 404 page when resource is not found
 */
export function ComponentWithResourceCheck() {
  const navigate = useNavigate();

  const checkResourceExists = async (id: string) => {
    try {
      const response = await fetch(`/api/resource/${id}`);
      if (response.status === 404) {
        // Resource not found, navigate to 404 page
        navigateTo404(navigate);
        return;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      navigateTo500(navigate, error as Error);
    }
  };

  return <div>Your component</div>;
}

// ============================================
// Example 4: Custom Error Boundary Callback
// ============================================

/**
 * Use custom error handler with ErrorBoundary
 */
export function ComponentWithCustomErrorHandler() {
  const handleError = (error: Error, errorInfo: any) => {
    // Log to external service (e.g., Sentry, LogRocket)
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to analytics
    // analytics.track('error', { error: error.message });
  };

  return (
    <ErrorBoundary onError={handleError}>
      <YourComponent />
    </ErrorBoundary>
  );
}

// ============================================
// Example 5: Custom Fallback UI
// ============================================

/**
 * Use custom fallback instead of default ServerError page
 */
export function ComponentWithCustomFallback() {
  const customFallback = (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">
        Oops! Something went wrong
      </h1>
      <p>We're working on fixing this issue.</p>
    </div>
  );

  return (
    <ErrorBoundary fallback={customFallback}>
      <YourComponent />
    </ErrorBoundary>
  );
}

// ============================================
// Example 6: Protected Route with Error Handling
// ============================================

/**
 * Handle authentication errors and redirect appropriately
 */
export function ProtectedComponentWithErrorHandling() {
  const navigate = useNavigate();

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/verify');
      
      if (response.status === 401) {
        // Not authenticated, redirect to login
        navigate('/login');
        return;
      }
      
      if (response.status === 403) {
        // Forbidden, redirect to 404 (hide existence of resource)
        navigateTo404(navigate);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Authentication failed');
      }
      
      return await response.json();
    } catch (error) {
      navigateTo500(navigate, error as Error);
    }
  };

  return <div>Protected content</div>;
}

// ============================================
// Example 7: API Error Handler Utility
// ============================================

/**
 * Create a reusable API error handler
 */
export function createApiErrorHandler(navigate: ReturnType<typeof useNavigate>) {
  return (error: any, context?: string) => {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

    if (error.message?.includes('404') || error.status === 404) {
      navigateTo404(navigate);
    } else {
      navigateTo500(navigate, error);
    }
  };
}

// Usage:
export function ComponentWithApiErrorHandler() {
  const navigate = useNavigate();
  const handleApiError = createApiErrorHandler(navigate);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      handleApiError(error, 'fetchData');
    }
  };

  return <div>Your component</div>;
}

// Placeholder components
function YourAppContent() { return <div>App Content</div>; }
function YourComponent() { return <div>Component</div>; }
