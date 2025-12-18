import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  checkInHandler,
  checkOutHandler,
  verifyAttendanceHandler,
  bulkSyncHandler,
  getEventAttendanceHandler,
  getCenterAttendanceHandler,
  correctAttendanceHandler,
  getMemberAttendanceHandler,
  generateCodeHandler,
  validateCodeHandler,
} from './controller.js';

const router = Router();

// POST /api/attendance/check-in - Check in member (high-throughput)
router.post('/check-in', authenticate, checkInHandler);

// POST /api/attendance/check-out - Check out member
router.post('/check-out', authenticate, checkOutHandler);

// POST /api/attendance/verify - Verify attendance
router.post('/verify', authenticate, verifyAttendanceHandler);

// POST /api/attendance/bulk-sync - Sync attendance from kiosk (offline queue)
router.post('/bulk-sync', authenticate, bulkSyncHandler);

// GET /api/attendance/event/:eventId - Get event attendance records
router.get('/event/:eventId', authenticate, getEventAttendanceHandler);

// GET /api/attendance/event/:eventId/center/:centerId - Get center attendance
router.get('/event/:eventId/center/:centerId', authenticate, getCenterAttendanceHandler);

// POST /api/attendance/:recordId/correct - Correct attendance record
router.post('/:recordId/correct', authenticate, correctAttendanceHandler);

// GET /api/attendance/member/:memberId - Get member attendance
router.get('/member/:memberId', authenticate, getMemberAttendanceHandler);

// POST /api/attendance/code/generate - Generate attendance code (QR/SAC)
router.post('/code/generate', authenticate, generateCodeHandler);

// POST /api/attendance/code/validate - Validate attendance code
router.post('/code/validate', authenticate, validateCodeHandler);

export default router;
