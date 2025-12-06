import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../../services/api";
import { dispatchAuthStateChange } from "../../utils/authEvents";

const clearSession = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  localStorage.removeItem("isAdmin");
  dispatchAuthStateChange();
};

const Logout: React.FC = () => {
  const [status, setStatus] = useState("Signing you out...");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logoutUser();
        setStatus("You have been signed out.");
      } catch (err: any) {
        console.error("Failed to contact logout endpoint:", err);
        setError(err?.message || "Failed to sign out from the server, clearing local session.");
      } finally {
        clearSession();
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    };

    performLogout();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white rounded-lg shadow p-8 max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Logout</h1>
        <p className="text-gray-600">
          {status} Redirecting you to the login page shortly. If nothing happens, use the button below.
        </p>
        {error && <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">{error}</div>}
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default Logout;
