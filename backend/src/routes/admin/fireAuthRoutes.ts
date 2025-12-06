import { Router } from "express";
import { createAccount, loginUser, logoutUser, verifyUserToken } from "../../services/fireAuth.js";
import { type SessionCreateAccountToken, type SessionToken } from "../../datContainers/sessionToken.js";
// Using real Firebase authentication
// Temporary: Using mock auth for development
// import { createMockAccount, loginMockUser, logoutMockUser, verifyMockToken } from "../services/mockAuth.js";

const router = Router();

// Create account endpoint
router.post("/create-account", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const accountData: SessionCreateAccountToken = { email, password };
    if (role) {
      accountData.role = role;
    }

    const sessionToken = await createAccount(accountData);
    res.status(201).json({ 
      message: "Account created successfully", 
      user: sessionToken 
    });
  } catch (error: any) {
    console.error("Error creating account:", error);
    res.status(400).json({ error: error.message });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const sessionToken = await loginUser(email, password);
    res.status(200).json({ 
      message: "Login successful", 
      user: sessionToken 
    });
  } catch (error: any) {
    console.error("Error logging in:", error);
    res.status(401).json({ error: error.message });
  }
});

// Logout endpoint
router.post("/logout", async (req, res) => {
  try {
    await logoutUser();
    res.status(200).json({ message: "Logout successful" });
  } catch (error: any) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: error.message });
  }
});

// Verify token endpoint
router.post("/verify-token", async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    const sessionToken = await verifyUserToken(idToken);
    res.status(200).json({ 
      message: "Token verified successfully", 
      user: sessionToken 
    });
  } catch (error: any) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: error.message });
  }
});

export default router;
