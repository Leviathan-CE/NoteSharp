
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../../components/common";
import { loginUser } from "../../services/api";
import { dispatchAuthStateChange } from "../../utils/authEvents";



function Login(): React.ReactElement {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");
        
        try {
            const response = await loginUser(email, password);
            console.log("Login response:", response);
            
            // Extract user data from the response
            const userData = response.user || {};
            

            if (!userData.token) {
                throw new Error('Login response did not include an authentication token.');
            }

            const resolvedRole = (userData.role || (userData.isAdmin ? 'admin' : 'user') || 'user').toLowerCase();
            const isAdmin = userData.isAdmin ?? resolvedRole === 'admin';

            // Store the authentication token and user data
            const user = {
                uid: userData.UID || '',
                displayName: userData.displayName || email.split('@')[0],
                email: userData.email || email,
                token: userData.token, // Firebase ID token
                role: resolvedRole,
                isAdmin
            };
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('authToken', user.token);
            localStorage.setItem('userRole', user.role);
            localStorage.setItem('userId', user.uid);
            localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
            dispatchAuthStateChange();

            setSuccess("Login successful! Redirecting...");
            // Navigate immediately - no need to wait
            navigate("/board", { replace: true });
        } catch (err: any) {
            setError(err.message || "An error occurred while logging in. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-400 to-blue-500">
            <form
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md"
            >
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
                
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
                    label="Email"
                    type="email"
                    value={email}
                    disabled={isLoading}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    disabled={isLoading}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    className="w-full"
                >
                    {isLoading ? "Logging in..." : "Login"}
                </Button>
                
                <div className="mt-4 text-center">
                    <p className="text-gray-600">
                        Don't have an account?{" "}
                        <a href="/create-account" className="text-blue-500 hover:underline">
                            Create one here
                        </a>
                    </p>
                </div>
            </form>
        </div>
    );
}

export default Login;
