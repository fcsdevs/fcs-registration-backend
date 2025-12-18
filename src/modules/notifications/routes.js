import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  createTriggerHandler,
  listTriggersHandler,
  getTriggerHandler,
  updateTriggerHandler,
  sendNotificationHandler,
  sendBatchHandler,
  getHistoryHandler,
  markDeliveredHandler,
  triggerRegistrationHandler,
  triggerCenterAssignmentHandler,
  triggerGroupAssignmentHandler,
  triggerEventReminderHandler,
} from './controller.js';

const router = Router();

/**
 * POST /api/notifications/triggers
 */
router.post('/triggers', authenticate, createTriggerHandler);

/**
 * GET /api/notifications/triggers/event/:eventId
 */
router.get('/triggers/event/:eventId', authenticate, listTriggersHandler);

/**
 * GET /api/notifications/triggers/:triggerId
 */
router.get('/triggers/:triggerId', authenticate, getTriggerHandler);

/**
 * PUT /api/notifications/triggers/:triggerId
 */
router.put('/triggers/:triggerId', authenticate, updateTriggerHandler);

/**
 * POST /api/notifications/send
 */
router.post('/send', authenticate, sendNotificationHandler);

/**
 * POST /api/notifications/send-batch
 */
router.post('/send-batch', authenticate, sendBatchHandler);

/**
 * GET /api/notifications/history
 */
router.get('/history', authenticate, getHistoryHandler);

/**
 * PUT /api/notifications/:notificationId/delivered
 */
router.put('/:notificationId/delivered', authenticate, markDeliveredHandler);

/**
 * POST /api/notifications/trigger-registration/:registrationId
 */
router.post('/trigger-registration/:registrationId', authenticate, triggerRegistrationHandler);

/**
 * POST /api/notifications/trigger-center-assignment/:registrationId
 */
router.post(
  '/trigger-center-assignment/:registrationId',
  authenticate,
  triggerCenterAssignmentHandler
);

/**
 * POST /api/notifications/trigger-group-assignment/:registrationId
 */
router.post(
  '/trigger-group-assignment/:registrationId',
  authenticate,
  triggerGroupAssignmentHandler
);

/**
 * POST /api/notifications/trigger-event-reminder/:eventId
 */
router.post('/trigger-event-reminder/:eventId', authenticate, triggerEventReminderHandler);

export default router;
