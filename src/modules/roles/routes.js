import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createRoleHandler,
  listRolesHandler,
  initPredefinedRolesHandler,
  getRoleHandler,
  updateRoleHandler,
  deactivateRoleHandler,
  assignRoleHandler,
  removeRoleHandler,
  getRoleUsersHandler,
  getUserRolesHandler,
  getUserPermissionsHandler,
  checkPermissionHandler,
  getPermissionGroupsHandler,
} from './controller.js';

const router = Router();

/**
 * POST /api/roles
 */
router.post('/', authenticate, createRoleHandler);

/**
 * GET /api/roles
 */
router.get('/', authenticate, listRolesHandler);

/**
 * POST /api/roles/init (MUST be before /:roleId)
 */
router.post('/init', authenticate, initPredefinedRolesHandler);

/**
 * GET /api/roles/permissions/groups (MUST be before /:roleId)
 */
router.get('/permissions/groups', authenticate, getPermissionGroupsHandler);

/**
 * GET /api/roles/users/:userId (MUST be before /:roleId)
 */
router.get('/users/:userId', authenticate, getUserRolesHandler);

/**
 * GET /api/roles/users/:userId/permissions (MUST be before /:roleId)
 */
router.get('/users/:userId/permissions', authenticate, getUserPermissionsHandler);

/**
 * POST /api/roles/users/:userId/permissions/:permission/check (MUST be before /:roleId)
 */
router.post(
  '/users/:userId/permissions/:permission/check',
  authenticate,
  checkPermissionHandler
);

/**
 * GET /api/roles/:roleId
 */
router.get('/:roleId', authenticate, getRoleHandler);

/**
 * PUT /api/roles/:roleId
 */
router.put('/:roleId', authenticate, updateRoleHandler);

/**
 * DELETE /api/roles/:roleId
 */
router.delete('/:roleId', authenticate, deactivateRoleHandler);

/**
 * GET /api/roles/:roleId/users
 */
router.get('/:roleId/users', authenticate, getRoleUsersHandler);

/**
 * POST /api/roles/:roleId/users/:userId
 */
router.post('/:roleId/users/:userId', authenticate, assignRoleHandler);

/**
 * DELETE /api/roles/:roleId/users/:userId
 */
router.delete('/:roleId/users/:userId', authenticate, removeRoleHandler);

export default router;
