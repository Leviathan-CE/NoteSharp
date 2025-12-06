import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { verifyAuthToken } from '../services/api';
import { dispatchAuthStateChange } from '../utils/authEvents';

interface AdminRouteProps {
  children: React.ReactElement;
}

type AdminStatus = 'loading' | 'unauthenticated' | 'denied' | 'granted';

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const [status, setStatus] = useState<AdminStatus>('loading');

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
      setStatus('unauthenticated');
      return;
    }

    const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
    const storedAdminFlag = localStorage.getItem('isAdmin');
    const hasAdminAccess = userRole === 'admin' || storedAdminFlag === 'true';

    if (hasAdminAccess) {
      setStatus('granted');
      return;
    }

    let cancelled = false;

    verifyAuthToken(authToken)
      .then((data) => {
        if (cancelled) return;
        const userData = data.user || {};
        const resolvedRole = (userData.role || (userData.isAdmin ? 'admin' : 'user') || 'user').toLowerCase();
        const isAdmin = userData.isAdmin ?? resolvedRole === 'admin';

        const storedUserRaw = localStorage.getItem('user');
        let storedUser: Record<string, unknown> = {};
        try {
          storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
        } catch {
          storedUser = {};
        }

        const updatedUser = {
          ...storedUser,
          uid: userData.UID || storedUser.uid,
          UID: userData.UID || storedUser.UID,
          email: userData.email || storedUser.email,
          displayName: userData.displayName || storedUser.displayName || 'no name user',
          token: storedUser.token || authToken,
          role: resolvedRole,
          isAdmin
        };

        localStorage.setItem('user', JSON.stringify(updatedUser));
        localStorage.setItem('userRole', resolvedRole);
        localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
        dispatchAuthStateChange();

        setStatus(isAdmin ? 'granted' : 'denied');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to verify admin access:', err);
        if (err.message === 'Invalid ID token' || err.message === 'ID token has expired') {
          setStatus('unauthenticated');
        } else {
          setStatus('denied');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Checking admin access...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'denied') {
    return <Navigate to="/board" replace />;
  }

  return children;
};

export default AdminRoute;
