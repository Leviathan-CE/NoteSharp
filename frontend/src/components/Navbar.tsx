import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AUTH_STATE_CHANGED_EVENT } from "../utils/authEvents";

const Navbar: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const syncAuthState = useCallback(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      return;
    }

    setIsLoggedIn(true);
    try {
      const parsedUser = JSON.parse(user);
      const role = (parsedUser?.role || localStorage.getItem("userRole") || "").toLowerCase();
      const storedAdminFlag = localStorage.getItem("isAdmin");
      const hasAdminPrivileges = Boolean(
        parsedUser?.isAdmin ||
        role === "admin" ||
        storedAdminFlag === "true"
      );
      setIsAdmin(hasAdminPrivileges);
    } catch (err) {
      console.error("Failed to parse stored user:", err);
      setIsAdmin(localStorage.getItem("userRole") === "admin");
    }
  }, []);

  useEffect(() => {
    syncAuthState();
  }, [location, syncAuthState]); // Re-check on route changes

  useEffect(() => {
    const handler = () => syncAuthState();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handler);
  }, [syncAuthState]);

  const handleLogout = () => {
    navigate("/logout");
  };

  return (
    <nav className="bg-blue-600 p-4 text-white flex justify-between">
      <div className="text-lg font-bold">
        <Link to="/about">NoteSharp</Link>
      </div>
      <div>
        {isLoggedIn ? (
          <>
          {isAdmin? (
            <>
            <Link to="/board" className="mr-4 hover:underline">Dashboard</Link>
            <Link to ="/admin" className="mr-4 hover:underline">Admin</Link>
            <button onClick={handleLogout} className="hover:underline">Logout</button>
            
          </>
          ):(
            <>
            <Link to="/board" className="mr-4 hover:underline">Dashboard</Link>
            <button onClick={handleLogout} className="hover:underline">Logout</button>
            </>
          )}
          </>
        ) : (
          <>
            <Link to="/login" className="mr-4 hover:underline">Login</Link>
            <Link to="/create-account" className="mr-4 hover:underline">Create Account</Link>
            <Link to="/about" className="hover:underline">About</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
