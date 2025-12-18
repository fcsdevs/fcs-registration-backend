import express from 'express';
import {
  createRegistrationHandler,
  listRegistrationsHandler,
  getRegistrationHandler,
  updateRegistrationStatusHandler,
  assignCenterHandler,
  assignGroupHandler,
  cancelRegistrationHandler,
  getEventRegistrationsHandler,
  getMemberRegistrationsHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/registrations - List registrations
router.get('/', authenticate, listRegistrationsHandler);

// POST /api/registrations - Create registration
router.post('/', authenticate, createRegistrationHandler);

// GET /api/registrations/:id - Get registration details
router.get('/:id', authenticate, getRegistrationHandler);

// PUT /api/registrations/:id/status - Update registration status
router.put('/:id/status', authenticate, updateRegistrationStatusHandler);

// POST /api/registrations/:id/assign-center - Assign center to registration
router.post('/:id/assign-center', authenticate, assignCenterHandler);

// POST /api/registrations/:id/assign-group - Assign group to registration
router.post('/:id/assign-group', authenticate, assignGroupHandler);

// DELETE /api/registrations/:id - Cancel registration
router.delete('/:id', authenticate, cancelRegistrationHandler);

// GET /api/registrations/event/:eventId - Get event registrations
router.get('/event/:eventId', authenticate, getEventRegistrationsHandler);

// GET /api/registrations/member/:memberId - Get member registrations
router.get('/member/:memberId', authenticate, getMemberRegistrationsHandler);

export default router;
