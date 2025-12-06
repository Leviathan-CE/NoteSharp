import React, { useState, useEffect } from "react";
import { Edit, Trash2, X, Check } from 'lucide-react';
import { API_URL } from "../services/api";
import AdminLayout from "../components/admin/AdminLayout";
import { getStoredAuthToken } from "../utils/auth";

interface User {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  isAdmin?: boolean;
  createdAt?: string;
}

function ManageUsers(): React.ReactElement {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");

  useEffect(() => {
    const fetchUsers = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 401 || response.status === 403) {
            throw new Error(errorData.error || "You do not have permission to view users.");
          }
          throw new Error(errorData.error || "Failed to fetch users.");
        }

        const data = await response.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
        setSuccess(`Loaded ${data.count ?? (data.users?.length || 0)} users from database.`);
      } catch (err: any) {
        setError(err.message || "Failed to fetch users.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    if (!searchTerm.trim()) {
      return true;
    }
    const normalizedSearch = searchTerm.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(normalizedSearch) ||
      user.email?.toLowerCase().includes(normalizedSearch) ||
      user.role?.toLowerCase().includes(normalizedSearch)
    );
  });

    const handleEditRole = (userId: string, currentRole: string) => {
        setEditingUserId(userId);
        setEditingRole(currentRole);
        setError("");
        setSuccess("");
    };

    const handleSaveRole = async (userId: string) => {
        const token = getStoredAuthToken();
        if (!token) {
            setError("Authentication token missing. Please log in again.");
            return;
        }

        try {

            const response = await fetch(`${API_URL}/users/${userId}/role`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: editingRole })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to update user role.");
            }

            setUsers(users.map(user => 
                user.uid === userId ? { ...user, role: editingRole, isAdmin: editingRole === "admin" } : user
            ));
            
            setSuccess(`User role updated to ${editingRole} successfully!`);
            setEditingUserId(null);
            setEditingRole("");
            
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to update user role.");
        }
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
        setEditingRole("");
        setError("");
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (!window.confirm(`Are you sure you want to delete user: ${userEmail}?`)) {
            return;
        }

        const token = getStoredAuthToken();
        if (!token) {
            setError("Authentication token missing. Please log in again.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to delete user.");
            }

            setUsers(users.filter(user => user.uid !== userId));
            setSuccess("User deleted successfully!");
            
            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to delete user.");
        }
    };
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-lg">Loading users...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Manage Users</h2>
                
                {error && (
                    <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError("")} className="text-red-700 hover:text-red-900">
                            <X size={20} />
                        </button>
                    </div>
                )}
                
                {success && (
                    <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex justify-between items-center">
                        <span>{success}</span>
                        <button onClick={() => setSuccess("")} className="text-green-700 hover:text-green-900">
                            <X size={20} />
                        </button>
                    </div>
                )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-4">
                        <input
                            type="text"
                            placeholder="Search by name, email, or role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-900">{user.displayName}</td>
                                    <td className="py-4 px-6 text-sm text-gray-700">{user.email}</td>
                                    <td className="py-4 px-6 text-sm">
                                        {editingUserId === user.uid ? (
                                            <div className="flex items-center space-x-2">
                                                <select
                                                    value={editingRole}
                                                    onChange={(e) => setEditingRole(e.target.value)}
                                                    className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="user">User</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                                <button
                                                    onClick={() => handleSaveRole(user.uid)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Save"
                                                >
                                                    <Check size={20} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Cancel"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                                user.role === 'admin' 
                                                    ? 'bg-purple-100 text-purple-800' 
                                                    : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {user.role}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-sm">
                                        <div className="flex space-x-3">
                                            {editingUserId !== user.uid && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditRole(user.uid, user.role)}
                                                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                                    >
                                                        <Edit size={16} />
                                                        <span>Edit Role</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.uid, user.email)}
                                                        className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span>Delete</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            {users.length === 0
                              ? "No users found."
                              : "No users match your search."}
                        </div>
                    )}
        </div>
      </div>
    </AdminLayout>
  );
}
export default ManageUsers;
