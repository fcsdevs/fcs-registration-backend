import express from 'express';
import { createInviteHandler, verifyInviteHandler, acceptInviteHandler } from './controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = express.Router();

// POST /api/invites - Create invite
router.post('/', authenticate, authorize(['National Admin', 'Regional Admin', 'State Admin', 'Zone Admin', 'Area Admin', 'Branch Admin']), createInviteHandler);

// GET /api/invites/verify - Verify token
router.get('/verify', verifyInviteHandler);

// POST /api/invites/accept - Accept invite
router.post('/accept', acceptInviteHandler);

export default router;
