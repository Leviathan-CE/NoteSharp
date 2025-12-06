import React, { useState } from "react";
import { createAccount, loginUser } from "../../services/api";
import { Button, Input } from "../../components/common";
import { useNavigate } from "react-router-dom";
import { dispatchAuthStateChange } from "../../utils/authEvents";

/**
 * attempts to creeate an account and then logs in the user into and nvigates 
 * to the mainboard page
 * @returns CreateAccount component
 */
function CreateAccount(): React.ReactElement {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError("Password should be at least 6 characters");
            setIsLoading(false);
            return;
        }

        try {
            console.log("Creating account with:", { email, password: "***" });
            const data = await createAccount(email, password);
            console.log("Account created successfully:", data);
            setSuccess("Account created successfully! Logging you in...");
            
            // now try to log in newly created user
            try {
                console.log("Logging in user:", { email, password: "***" });
                const loginData = await loginUser(email, password);
                console.log("Login successful - full response:", loginData);
                console.log("User object:", loginData.user);
                // The backend returns user data with ID token
                const userData = loginData.user;
                if (!userData?.token) {
                    throw new Error('Login response did not include an authentication token.');
                }
                
                // Save user to localStorage with token (token is not stored in DB, only used for API auth)
                const resolvedRole = (userData.role || (userData.isAdmin ? 'admin' : 'user') || 'user').toLowerCase();
                const isAdmin = userData.isAdmin ?? resolvedRole === 'admin';

                const user = { 
                    uid: userData.UID, 
                    displayName: userData.displayName || email.split('@')[0], 
                    email: userData.email || email,
                    token: userData.token,
                    role: resolvedRole,
                    isAdmin
                };
                console.log("Storing user:", user);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('authToken', user.token);
                localStorage.setItem('userRole', user.role);
                localStorage.setItem('userId', user.uid);
                localStorage.setItem('isAdmin', JSON.stringify(isAdmin));
                dispatchAuthStateChange();
                console.log("Stored in localStorage:", localStorage.getItem('user'));
                
                setSuccess("Login successful! Redirecting...");
                setTimeout(() => {
                    navigate("/board");
                }, 1000);
            } catch (loginErr: any) {
                console.error("Login error:", loginErr);
                setError(loginErr.message || "Account created but login failed. Please try logging in manually.");
            }
          
        } catch (err: any) {
            console.error("Create account error:", err);
            setError(err.message || "An error occurred while creating the account");
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
                <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>
                
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                />
                
                <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                />

                
                <Input
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                />
                
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
                
                <div className="mt-4 text-center">
                    <p className="text-gray-600">
                        Already have an account?{" "}
                        <a href="/login" className="text-blue-500 hover:underline">
                            Login here
                        </a>
                    </p>
                </div>
            </form>
        </div>
    );
}

export default CreateAccount;
