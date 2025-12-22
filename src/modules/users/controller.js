import {
    listUsers,
    assignUserRole,
    revokeUserRole,
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
        // Validate body manually or via schema
        const { role, unitId } = req.body;
        if (!role) throw new Error("Role is required");

        await assignUserRole(req.params.id, role, unitId, req.userId);
        res.status(200).json({ message: "Role assigned successfully" });
    } catch (error) {
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
