import {
    listUsersHandler,
    assignUserRoleHandler,
    revokeUserRoleHandler,
    getUserByIdHandler,
    updateProfileHandler,
    updateUserHandler,
} from './controller.js';
import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = express.Router();

// PUT /api/users/profile - Update current user profile
router.put('/profile', authenticate, updateProfileHandler);

// GET /api/users - List users with filters (role, unitId)
router.get('/', authenticate, authorize(['National Admin', 'Area Admin', 'State Admin', 'Zone Admin', 'Branch Admin', 'Registrar']), listUsersHandler);

// GET /api/users/:id - Get user details
router.get('/:id', authenticate, authorize(['National Admin', 'Area Admin', 'State Admin', 'Zone Admin', 'Branch Admin', 'Registrar']), getUserByIdHandler);

// PUT /api/users/:id - Update user details (for admins)
router.put('/:id', authenticate, authorize(['National Admin', 'Area Admin', 'State Admin', 'Zone Admin', 'Branch Admin']), updateUserHandler);

// PUT /api/users/:id/roles - Assign/Update user role
router.put('/:id/roles', authenticate, authorize(['National Admin', 'Area Admin', 'State Admin', 'Zone Admin', 'Branch Admin']), assignUserRoleHandler);

// DELETE /api/users/:id/roles/:role - Revoke user role
router.delete('/:id/roles/:role', authenticate, authorize(['National Admin', 'Area Admin', 'State Admin', 'Zone Admin']), revokeUserRoleHandler);

export default router;
