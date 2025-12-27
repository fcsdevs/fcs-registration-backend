import {
    listUsersHandler,
    assignUserRoleHandler,
    revokeUserRoleHandler,
    getUserByIdHandler,
} from './controller.js';
import express from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/users - List users with filters (role, unitId)
router.get('/', authenticate, authorize(['National Admin', 'Regional Admin', 'State Admin', 'Zone Admin', 'Area Admin', 'Branch Admin']), listUsersHandler);

// GET /api/users/:id - Get user details
router.get('/:id', authenticate, authorize(['National Admin', 'Regional Admin', 'State Admin', 'Zone Admin', 'Area Admin', 'Branch Admin']), getUserByIdHandler);

// PUT /api/users/:id/roles - Assign/Update user role
router.put('/:id/roles', authenticate, authorize(['National Admin', 'Regional Admin', 'State Admin', 'Zone Admin', 'Area Admin']), assignUserRoleHandler);

// DELETE /api/users/:id/roles/:role - Revoke user role
router.delete('/:id/roles/:role', authenticate, authorize(['National Admin', 'Regional Admin', 'State Admin', 'Zone Admin']), revokeUserRoleHandler);

export default router;
