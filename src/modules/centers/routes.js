import express from 'express';
import {
  createCenterHandler,
  listCentersHandler,
  listActiveCentersHandler,
  getCenterHandler,
  updateCenterHandler,
  addCenterAdminHandler,
  removeCenterAdminHandler,
  getCenterStatisticsHandler,
  deactivateCenterHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/centers/active - List active centers for registration
router.get('/active', listActiveCentersHandler);

// GET /api/centers - List all centers
router.get('/', authenticate, listCentersHandler);

// POST /api/centers - Create center
router.post('/', authenticate, createCenterHandler);

// GET /api/centers/:id - Get center details
router.get('/:id', getCenterHandler);

// PUT /api/centers/:id - Update center
router.put('/:id', authenticate, updateCenterHandler);

// POST /api/centers/:id/admins - Add center admin
router.post('/:id/admins', authenticate, addCenterAdminHandler);

// DELETE /api/centers/:id/admins/:userId - Remove center admin
router.delete('/:id/admins/:userId', authenticate, removeCenterAdminHandler);

// GET /api/centers/:id/statistics - Get center statistics
router.get('/:id/statistics', authenticate, getCenterStatisticsHandler);

// DELETE /api/centers/:id - Deactivate center
router.delete('/:id', authenticate, deactivateCenterHandler);

export default router;
