import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Trash2,
  Download,
  Upload,
  CheckSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { API_URL } from "../../services/api";
import { getStoredAuthToken } from "../../utils/auth";

type BulkUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
};

const BulkOperations: React.FC = () => {
  const [users, setUsers] = useState<BulkUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [operation, setOperation] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [operationResult, setOperationResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const token = getStoredAuthToken();

    if (!token) {
      setLoadError("Missing admin token. Please log in again.");
      setLoadingUsers(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load users.");
      }

      const data = await response.json();
      const mapped: BulkUser[] = (data.users || []).map((user: any) => ({
        id: user.uid,
        name: user.displayName || "Unnamed User",
        email: user.email || "unknown",
        role: user.role || (user.isAdmin ? "admin" : "user"),
        status: "active",
        lastActive: user.updatedAt || user.createdAt || "unknown",
      }));

      setUsers(mapped);
      setLoadError("");
    } catch (err: any) {
      console.error("Failed to load users for bulk operations:", err);
      setLoadError(err.message || "Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return users;
    }
    const query = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
    );
  }, [users, searchTerm]);

  useEffect(() => {
    setSelectedUsers((prev) => {
      const updated = new Set<string>();
      filteredUsers.forEach((user) => {
        if (prev.has(user.id)) {
          updated.add(user.id);
        }
      });
      setSelectAll(filteredUsers.length > 0 && updated.size === filteredUsers.length);
      return updated;
    });
  }, [filteredUsers]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((user) => user.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const updated = new Set(prev);
      if (updated.has(userId)) {
        updated.delete(userId);
      } else {
        updated.add(userId);
      }
      setSelectAll(updated.size === filteredUsers.length && filteredUsers.length > 0);
      return updated;
    });
  };

  const handleOperation = () => {
    if (selectedUsers.size === 0) {
      setOperationResult({ type: "error", message: "Please select at least one user." });
      return;
    }
    if (!operation) {
      setOperationResult({ type: "error", message: "Please select an operation." });
      return;
    }
    setShowConfirmation(true);
  };

  const performBulkDelete = async (ids: string[], token: string) => {
    for (const id of ids) {
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete user ${id}`);
      }
    }
  };

  const executeOperation = async () => {
    setIsProcessing(true);
    setShowConfirmation(false);

    try {
      const token = getStoredAuthToken();
      if (!token) {
        throw new Error("Missing admin token. Please log in again.");
      }

      const userIds = Array.from(selectedUsers);
      let message = "";

      switch (operation) {
        case "delete":
          await performBulkDelete(userIds, token);
          await fetchUsers();
          message = `${userIds.length} user(s) deleted successfully!`;
          break;
        default:
          message = `Operation '${operation}' simulated for ${userIds.length} user(s).`;
          break;
      }

      setOperationResult({ type: "success", message });
      setSelectedUsers(new Set());
      setSelectAll(false);
      setOperation("");
      setEmailSubject("");
      setEmailMessage("");
      setTimeout(() => setOperationResult(null), 5000);
    } catch (err: any) {
      setOperationResult({ type: "error", message: err.message || "Failed to perform operation." });
      setTimeout(() => setOperationResult(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "inactive":
        return "text-gray-600 bg-gray-100";
      case "suspended":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Bulk Operations</h1>
          <p className="text-gray-600">Perform operations on multiple users at once.</p>
        </header>

        {operationResult && (
          <div
            className={`p-4 rounded-lg border flex items-center gap-3 ${
              operationResult.type === "success"
                ? "bg-green-100 border-green-400 text-green-700"
                : "bg-red-100 border-red-400 text-red-700"
            }`}
          >
            {operationResult.type === "success" ? <CheckCircle size={24} /> : <XCircle size={24} />}
            <span>{operationResult.message}</span>
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-lg border border-red-400 bg-red-50 text-red-700">{loadError}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-lg shadow p-6 space-y-4 sticky top-6 h-fit">
            <div className="p-3 border-2 border-blue-500 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-800 mb-1">{selectedUsers.size} user(s) selected</p>
              <p className="text-xs text-blue-600">
                {loadingUsers ? "Loading users..." : "Choose an operation to perform"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an operation...</option>
                <option value="send-email">📧 Send Email</option>
                <option value="activate">✅ Activate Users</option>
                <option value="suspend">⛔ Suspend Users</option>
                <option value="reset-password">🔑 Reset Passwords</option>
                <option value="export">💾 Export Data</option>
                <option value="delete">🗑️ Delete Users</option>
              </select>
            </div>

            {operation === "send-email" && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Message</label>
                  <textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            )}

            {operation && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  {operation === "send-email" && "Send a custom email to selected users"}
                  {operation === "activate" && "Activate all selected user accounts"}
                  {operation === "suspend" && "Suspend selected user accounts"}
                  {operation === "reset-password" && "Send password reset emails to selected users"}
                  {operation === "export" && "Export selected users' data to CSV"}
                  {operation === "delete" && "⚠️ Permanently delete selected user accounts"}
                </span>
              </div>
            )}

            <button
              onClick={handleOperation}
              disabled={selectedUsers.size === 0 || !operation || isProcessing || loadingUsers}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckSquare size={20} />
                  Execute Operation
                </>
              )}
            </button>

            <div className="pt-6 border-t space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Quick Actions</h3>
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <Download size={16} />
                Import Users (CSV)
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <Upload size={16} />
                Export All Users
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                <Trash2 size={16} />
                Remove Inactive Users
              </button>
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-6 border-b flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">User Selection</h2>
                  <p className="text-sm text-gray-500">
                    {filteredUsers.length} of {users.length} users matching filter
                  </p>
                </div>
              </div>
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {loadingUsers ? (
              <div className="p-6 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                {users.length === 0 ? "No users found." : "No users match your search."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-gray-50 ${selectedUsers.has(user.id) ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.lastActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-6 py-3 border-t text-sm text-gray-500">
              {selectedUsers.size} of {filteredUsers.length} shown users selected
            </div>
          </section>
        </div>

        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-yellow-600" />
                <h3 className="text-xl font-semibold text-gray-800">Confirm Operation</h3>
              </div>
              <p className="text-gray-600">
                Are you sure you want to perform this operation on <strong>{selectedUsers.size}</strong> user(s)?
                {operation === "delete" && (
                  <span className="block mt-2 text-red-600 font-semibold">⚠️ This action cannot be undone!</span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeOperation}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    operation === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default BulkOperations;
