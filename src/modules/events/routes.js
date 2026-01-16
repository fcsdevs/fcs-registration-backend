import express from 'express';
import {
  createEventHandler,
  listEventsHandler,
  getEventHandler,
  updateEventHandler,
  publishEventHandler,
  getEventStatisticsHandler,
  updateEventSettingsHandler,
  deleteEventHandler,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

import { uploadPhoto, eventImgResize } from '../../middleware/upload.js';

const router = express.Router();

// GET /api/events - List events
router.get('/', listEventsHandler);

// POST /api/events - Create event
router.post('/', authenticate, uploadPhoto.single('image'), eventImgResize, createEventHandler);

// GET /api/events/:id - Get event details
router.get('/:id', getEventHandler);

// PUT /api/events/:id - Update event
router.put('/:id', authenticate, uploadPhoto.single('image'), eventImgResize, updateEventHandler);

// POST /api/events/:id/publish - Publish event
router.post('/:id/publish', authenticate, publishEventHandler);

// GET /api/events/:id/statistics - Get event stats
router.get('/:id/statistics', authenticate, getEventStatisticsHandler);

// PUT /api/events/:id/settings - Update event settings
router.put('/:id/settings', authenticate, updateEventSettingsHandler);

// DELETE /api/events/:id - Delete event
router.delete('/:id', authenticate, deleteEventHandler);

export default router;
