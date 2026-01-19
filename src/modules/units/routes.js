import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createUnitHandler,
  listUnitsHandler,
  getHierarchyHandler,
  getUnitHandler,
  updateUnitHandler,
  getChildUnitsHandler,
  addMemberHandler,
  removeMemberHandler,
  getUnitMembersHandler,
  getUnitStatsHandler,
  deactivateUnitHandler,
} from './controller.js';

const router = Router();

/**
 * POST /api/units
 */
router.post('/', authenticate, createUnitHandler);

/**
 * GET /api/units
 * Publicly accessible but scoped if authenticated
 */
router.get('/', listUnitsHandler);

/**
 * GET /api/units/hierarchy
 */
router.get('/hierarchy', authenticate, getHierarchyHandler);

/**
 * GET /api/units/:unitId
 */
router.get('/:unitId', authenticate, getUnitHandler);

/**
 * PUT /api/units/:unitId
 */
router.put('/:unitId', authenticate, updateUnitHandler);

/**
 * GET /api/units/:unitId/children
 */
router.get('/:unitId/children', authenticate, getChildUnitsHandler);

/**
 * GET /api/units/:unitId/members
 */
router.get('/:unitId/members', authenticate, getUnitMembersHandler);

/**
 * POST /api/units/:unitId/members/:memberId
 */
router.post('/:unitId/members/:memberId', authenticate, addMemberHandler);

/**
 * DELETE /api/units/:unitId/members/:memberId
 */
router.delete('/:unitId/members/:memberId', authenticate, removeMemberHandler);

/**
 * GET /api/units/:unitId/statistics
 */
router.get('/:unitId/statistics', authenticate, getUnitStatsHandler);

/**
 * DELETE /api/units/:unitId
 */
router.delete('/:unitId', authenticate, deactivateUnitHandler);

export default router;
