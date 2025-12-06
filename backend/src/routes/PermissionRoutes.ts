import { Router } from "express";
import {
    AdduserPermission,
    ChangePermission,
    RemovePermission,
    getPermision
} from "../services/dbPermissions.js";
import type { SessionToken } from "../datContainers/sessionToken.js";
import { Permision } from "../datContainers/dataTypes.js";

const router = Router();

/**
 * POST /add-permission
 * Adds a user permission to a board
 * Note: OWNER permission cannot be added using this endpoint
 */
router.post("/add-permission", async (req, res) => {
    try {
        const { user, permission, boardId } = req.body;

        if (!user || !user.UID) {
            return res.status(400).json({ error: "User session token with UID is required" });
        }

        if (!permission) {
            return res.status(400).json({ error: "Permission type is required" });
        }

        if (!boardId) {
            return res.status(400).json({ error: "Board ID is required" });
        }

        // Validate permission type
        if (permission === Permision.OWNER) {
            return res.status(400).json({ 
                error: "OWNER permission cannot be added using this endpoint. Use change-permission instead." 
            });
        }

        if (permission !== Permision.VIEW && permission !== Permision.EDIT) {
            return res.status(400).json({ 
                error: "Permission must be either 'view' or 'edit'" 
            });
        }

        const userPermission = await AdduserPermission(
            user as SessionToken,
            permission as Permision,
            boardId
        );

        res.status(201).json({
            message: "Permission added successfully",
            permission: userPermission
        });
    } catch (error: any) {
        console.error("Error adding permission:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /change-permission
 * Changes an existing user permission
 * Special: Changing to OWNER will transfer board ownership
 */
router.put("/change-permission", async (req, res) => {
    try {
        const { permissionId, newPermission } = req.body;

        if (!permissionId) {
            return res.status(400).json({ error: "Permission ID is required" });
        }

        if (!newPermission) {
            return res.status(400).json({ error: "New permission type is required" });
        }

        // Validate permission type
        if (newPermission !== Permision.VIEW && 
            newPermission !== Permision.EDIT && 
            newPermission !== Permision.OWNER) {
            return res.status(400).json({ 
                error: "Permission must be 'view', 'edit', or 'owner'" 
            });
        }

        await ChangePermission(permissionId, newPermission as Permision);

        res.status(200).json({
            message: "Permission changed successfully"
        });
    } catch (error: any) {
        console.error("Error changing permission:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /remove-permission
 * Removes a user permission from the database
 */
router.delete("/remove-permission", async (req, res) => {
    try {
        // DELETE requests might not have body parsed - safely get permissionId
        const permissionId = req.body?.permissionId;

        if (!permissionId) {
            return res.status(400).json({ error: "Permission ID is required" });
        }

        await RemovePermission(permissionId);

        res.status(200).json({
            message: "Permission removed successfully"
        });
    } catch (error: any) {
        console.error("Error removing permission:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /get-permissions
 * Retrieves all permissions for a user, optionally filtered
 * Query parameters: permissionId?, boardId?, permission?
 * Body: sessionToken
 */
router.get("/get-permissions", async (req, res) => {
    try {
        const { permissionId, boardId, permission } = req.query;
        
        // Validate permission type FIRST (before sessionToken) if provided in query
        // This allows us to return specific error messages for permission validation
        if (permission !== undefined && permission !== null && permission !== '') {
            const permissionStr = String(permission);
            
            // First check if it's a valid permission type
            if (permissionStr !== Permision.VIEW && 
                permissionStr !== Permision.EDIT && 
                permissionStr !== Permision.OWNER) {
                return res.status(400).json({ 
                    error: "Permission must be 'view', 'edit', or 'owner'" 
                });
            }

            // Note: OWNER permissions don't exist as separate permission documents
            // They are stored as the owner field in the board document
            if (permissionStr === Permision.OWNER) {
                return res.status(400).json({ 
                    error: "OWNER permissions do not exist as separate permission documents. They are stored as the owner field in the board database." 
                });
            }
        }
        
        // GET requests might not have body parsed - safely get sessionToken
        // Check if body exists and has sessionToken
        const sessionToken = req.body?.sessionToken;

        // Validate sessionToken - check if it exists and has UID
        if (!sessionToken) {
            return res.status(400).json({ error: "Session token with UID is required in request body" });
        }
        
        // Check if sessionToken is a valid object (not null, not array)
        if (typeof sessionToken !== 'object' || sessionToken === null || Array.isArray(sessionToken)) {
            return res.status(400).json({ error: "Session token with UID is required in request body" });
        }
        
        // Check if sessionToken has a valid UID string property
        if (!('UID' in sessionToken) || typeof sessionToken.UID !== 'string' || !sessionToken.UID) {
            return res.status(400).json({ error: "Session token with UID is required in request body" });
        }

        const permissions = await getPermision(
            sessionToken as SessionToken,
            (permissionId as string) || "",
            (boardId as string) || "",
            (permission as string) || ""
        );

        res.status(200).json({
            message: "Permissions retrieved successfully",
            permissions: permissions,
            count: permissions.length
        });
    } catch (error: any) {
        console.error("Error getting permissions:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

