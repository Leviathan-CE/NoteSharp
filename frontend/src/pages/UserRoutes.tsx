import React from 'react';
import { Navigate } from 'react-router-dom';

interface UserRouteProps {
  children: React.ReactElement;
}

const UserRoute: React.FC<UserRouteProps> = ({ children }) => {
  const user = localStorage.getItem("user");
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // With mock auth, everyone who is logged in can access user routes
  return children;
};

export default UserRoute;