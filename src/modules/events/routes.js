import express from 'express';
import {
  createEventHandler,
  listEventsHandler,
  getEventHandler,
  updateEventHandler,
  publishEventHandler,
  getEventStatisticsHandler,
  updateEventSettingsHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/events - List events
router.get('/', listEventsHandler);

// POST /api/events - Create event
router.post('/', authenticate, createEventHandler);

// GET /api/events/:id - Get event details
router.get('/:id', getEventHandler);

// PUT /api/events/:id - Update event
router.put('/:id', authenticate, updateEventHandler);

// POST /api/events/:id/publish - Publish event
router.post('/:id/publish', authenticate, publishEventHandler);

// GET /api/events/:id/statistics - Get event stats
router.get('/:id/statistics', authenticate, getEventStatisticsHandler);

// PUT /api/events/:id/settings - Update event settings
router.put('/:id/settings', authenticate, updateEventSettingsHandler);

export default router;
