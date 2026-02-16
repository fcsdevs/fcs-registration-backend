import {
    listUsers,
    assignUserRole,
    revokeUserRole,
    getUserById,
    getEffectiveScope,
    updateUserProfile,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';

export const updateProfileHandler = async (req, res, next) => {
    try {
        const userId = req.userId; // Always update self
        const result = await updateUserProfile(userId, req.body);
        res.status(200).json({
            message: 'Profile updated successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const updateUserHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await updateUserProfile(id, req.body);
        res.status(200).json({
            message: 'User updated successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const listUsersHandler = async (req, res, next) => {
    try {
        // Enforce Scope
        const scope = await getEffectiveScope(req.userId);
        let effectiveUnitId = req.query.unitId;

        if (!scope.isGlobal) {
            // For non-global admins, restrict to their scope
            // TODO: Allow drill-down if requested unit is a valid descendant
            effectiveUnitId = scope.unitId;
            console.log(`🔒 [SECURITY] Enforcing scope for User ${req.userId}: ${effectiveUnitId} (${scope.level})`);
        }

        const queryParams = { ...req.query };
        if (effectiveUnitId) {
            queryParams.unitId = effectiveUnitId;
        } else {
            // For global admins with no unitId specified, remove the unitId from query
            delete queryParams.unitId;
        }

        const users = await listUsers({
            ...queryParams,
            currentUserId: req.userId,
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
