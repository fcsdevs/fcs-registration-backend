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
  getRegistrarStatisticsHandler,
  getGlobalRegistrationsStatsHandler,
  markAttendanceHandler,
  downloadTagHandler
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/registrations - List registrations
router.get('/', authenticate, listRegistrationsHandler);

// POST /api/registrations - Create registration
router.post('/', authenticate, createRegistrationHandler);

// GET /api/registrations/event/:eventId - Get event registrations (MUST be before /:id)
router.get('/event/:eventId', authenticate, getEventRegistrationsHandler);

// GET /api/registrations/member/:memberId - Get member registrations (MUST be before /:id)
router.get('/member/:memberId', authenticate, getMemberRegistrationsHandler);

// GET /api/registrations/stats - Get registrar statistics (MUST be before /:id)
// Query params: eventId (required), centerId (optional)
router.get('/stats', authenticate, getRegistrarStatisticsHandler);

// GET /api/registrations/stats/summary - Get global registration statistics (MUST be before /:id)
router.get('/stats/summary', authenticate, getGlobalRegistrationsStatsHandler);

// GET /api/registrations/:id - Get registration details
// GET /api/registrations/:id - Get registration details
router.get('/:id', authenticate, getRegistrationHandler);

// GET /api/registrations/:id/tag-pdf - Download tag PDF
router.get('/:id/tag-pdf', authenticate, downloadTagHandler);

// PUT /api/registrations/:id/status - Update registration status
router.put('/:id/status', authenticate, updateRegistrationStatusHandler);

// POST /api/registrations/:id/attendance - Mark attendance
router.post('/:id/attendance', authenticate, markAttendanceHandler);

// POST /api/registrations/:id/assign-center - Assign center to registration
router.post('/:id/assign-center', authenticate, assignCenterHandler);

// POST /api/registrations/:id/assign-group - Assign group to registration
router.post('/:id/assign-group', authenticate, assignGroupHandler);

// DELETE /api/registrations/:id - Cancel registration
router.delete('/:id', authenticate, cancelRegistrationHandler);

export default router;
