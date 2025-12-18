import express from 'express';
import {
  createMemberHandler,
  listMembersHandler,
  getMemberHandler,
  getMemberByCodeHandler,
  updateMemberHandler,
  getAttendanceSummaryHandler,
  addGuardianHandler,
  removeGuardianHandler,
  deactivateMemberHandler,
  searchMembersHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/members/search - Search members
router.get('/search', authenticate, searchMembersHandler);

// GET /api/members - List all members
router.get('/', authenticate, listMembersHandler);

// POST /api/members - Create member
router.post('/', authenticate, createMemberHandler);

// GET /api/members/:id - Get member details
router.get('/:id', authenticate, getMemberHandler);

// GET /api/members/code/:code - Get member by FCS code
router.get('/code/:code', authenticate, getMemberByCodeHandler);

// PUT /api/members/:id - Update member
router.put('/:id', authenticate, updateMemberHandler);

// GET /api/members/:id/attendance-summary - Get member attendance
router.get('/:id/attendance-summary', authenticate, getAttendanceSummaryHandler);

// POST /api/members/:id/guardians - Add guardian
router.post('/:id/guardians', authenticate, addGuardianHandler);

// DELETE /api/members/:id/guardians/:guardianId - Remove guardian
router.delete('/:id/guardians/:guardianId', authenticate, removeGuardianHandler);

// DELETE /api/members/:id - Deactivate member
router.delete('/:id', authenticate, deactivateMemberHandler);

export default router;
