import {
    listUsers,
    assignUserRole,
    revokeUserRole,
    getUserById,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';

export const listUsersHandler = async (req, res, next) => {
    try {
        const users = await listUsers({
            ...req.query,
            currentUserId: req.userId, // For scoping logic if needed
        });
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
};

export const assignUserRoleHandler = async (req, res, next) => {
    try {
        console.log('🔍 [BACKEND] Assign Role Request:', {
            userId: req.params.id,
            body: req.body,
            assignedBy: req.userId
        });

        // Validate body manually or via schema
        const { role, unitId, replaceExisting } = req.body;
        if (!role) throw new Error("Role is required");

        const result = await assignUserRole(req.params.id, role, unitId, req.userId, replaceExisting);
        console.log('✅ [BACKEND] Role assigned successfully:', result);
        res.status(200).json({ message: "Role assigned successfully", data: result });
    } catch (error) {
        console.error('❌ [BACKEND] Role assignment failed:', error);
        next(error);
    }
};

export const revokeUserRoleHandler = async (req, res, next) => {
    try {
        const { role } = req.params;
        await revokeUserRole(req.params.id, role, req.userId);
        res.status(200).json({ message: "Role revoked successfully" });
    } catch (error) {
        next(error);
    }
};

export const getUserByIdHandler = async (req, res, next) => {
    try {
        const user = await getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};
