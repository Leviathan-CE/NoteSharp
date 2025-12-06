import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/common";
import { getStoredAuthToken } from "../utils/auth";

function CreateUsers(): React.ReactElement {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("user");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");

        try {
            // Call your API to create a new user
            const token = getStoredAuthToken();
            if (!token) {
                throw new Error("Missing authentication token. Please log in again.");
            }

            const response = await fetch("/api/users", {
                method: "POST",
                headers: {'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password, role }),
            });
            setSuccess("User created successfully!");
            setEmail("");
            setPassword("");
            setRole("user");
        } catch (err: any) {
            setError(err.message || "An error occurred while creating the user. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <form
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md"
            >
                <h2 className="text-2xl font-bold mb-6 text-center">Create User</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                        {success}
                    </div>
                )}

                <Input
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <Input
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Role</label>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                    >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Creating..." : "Create User"}
                </Button>  
            </form>
        </div>
    );
}

export default CreateUsers;
