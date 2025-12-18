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
 * POST /api/roles/init
 */
router.post('/init', authenticate, initPredefinedRolesHandler);

/**
 * GET /api/roles/permissions/groups
 */
router.get('/permissions/groups', authenticate, getPermissionGroupsHandler);

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

/**
 * GET /api/roles/users/:userId
 */
router.get('/users/:userId', authenticate, getUserRolesHandler);

/**
 * GET /api/roles/users/:userId/permissions
 */
router.get('/users/:userId/permissions', authenticate, getUserPermissionsHandler);

/**
 * POST /api/roles/users/:userId/permissions/:permission/check
 */
router.post(
  '/users/:userId/permissions/:permission/check',
  authenticate,
  checkPermissionHandler
);

export default router;
