import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createGroupHandler,
  listGroupsHandler,
  getGroupHandler,
  updateGroupHandler,
  getGroupMembersHandler,
  assignMemberHandler,
  removeMemberHandler,
  bulkAssignHandler,
  getGroupStatsHandler,
  deactivateGroupHandler,
} from './controller.js';

const router = Router();

/**
 * POST /api/groups
 */
router.post('/', authenticate, createGroupHandler);

/**
 * GET /api/groups/event/:eventId
 */
router.get('/event/:eventId', authenticate, listGroupsHandler);

/**
 * POST /api/groups/bulk-assign
 */
router.post('/bulk-assign', authenticate, bulkAssignHandler);

/**
 * GET /api/groups/:groupId
 */
router.get('/:groupId', authenticate, getGroupHandler);

/**
 * PUT /api/groups/:groupId
 */
router.put('/:groupId', authenticate, updateGroupHandler);

/**
 * GET /api/groups/:groupId/members
 */
router.get('/:groupId/members', authenticate, getGroupMembersHandler);

/**
 * POST /api/groups/:groupId/assign
 */
router.post('/:groupId/assign', authenticate, assignMemberHandler);

/**
 * DELETE /api/groups/:groupId/members/:memberId
 */
router.delete('/:groupId/members/:memberId', authenticate, removeMemberHandler);

/**
 * GET /api/groups/:groupId/statistics
 */
router.get('/:groupId/statistics', authenticate, getGroupStatsHandler);

/**
 * DELETE /api/groups/:groupId
 */
router.delete('/:groupId', authenticate, deactivateGroupHandler);

export default router;
