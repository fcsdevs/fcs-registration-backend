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
  updateProfileHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadPhoto, eventImgResize } from '../../middleware/upload.js';

const router = express.Router();

// GET /api/members/search - Search members (MUST be before /:id)
router.get('/search', authenticate, searchMembersHandler);

// GET /api/members - List all members
router.get('/', authenticate, listMembersHandler);

// POST /api/members - Create member
router.post('/', authenticate, uploadPhoto.single('image'), eventImgResize, createMemberHandler);

// GET /api/members/code/:code - Get member by FCS code (MUST be before /:id)
router.get('/code/:code', authenticate, getMemberByCodeHandler);

// PUT /api/members/profile - Update own profile (MUST be before /:id)
router.put('/profile', authenticate, uploadPhoto.single('image'), eventImgResize, updateProfileHandler);

// GET /api/members/:id - Get member details
router.get('/:id', authenticate, getMemberHandler);

// PUT /api/members/:id - Update member
router.put('/:id', authenticate, uploadPhoto.single('image'), eventImgResize, updateMemberHandler);

// GET /api/members/:id/attendance-summary - Get member attendance
router.get('/:id/attendance-summary', authenticate, getAttendanceSummaryHandler);

// POST /api/members/:id/guardians - Add guardian
router.post('/:id/guardians', authenticate, addGuardianHandler);

// DELETE /api/members/:id/guardians/:guardianId - Remove guardian
router.delete('/:id/guardians/:guardianId', authenticate, removeGuardianHandler);

// DELETE /api/members/:id - Deactivate member
router.delete('/:id', authenticate, deactivateMemberHandler);

export default router;
