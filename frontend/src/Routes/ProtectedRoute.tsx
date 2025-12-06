import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

/**
 * ProtectedRoute component that checks for user authentication
 * If user is not in localStorage, redirects to login page
 */
function ProtectedRoute({ children }: ProtectedRouteProps): React.ReactElement {
  // Check if user exists in localStorage
  const getUser = (): { uid: string; email: string; displayName?: string } | null => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      
      const user = JSON.parse(userStr);
      // Validate that user has required fields
      if (user && user.uid && user.email) {
        return user;
      }
      return null;
    } catch (error) {
      console.error('Error reading user from localStorage:', error);
      return null;
    }
  };

  const user = getUser();

  // If no user found, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected component
  return children;
}

export default ProtectedRoute;

