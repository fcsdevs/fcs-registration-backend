import {
  createNotificationTrigger,
  getNotificationTrigger,
  listNotificationTriggers,
  sendNotification,
  sendBatchNotifications,
  getNotificationHistory,
  triggerRegistrationNotifications,
  triggerCenterAssignmentNotifications,
  triggerGroupAssignmentNotifications,
  triggerEventReminderNotifications,
  markNotificationAsDelivered,
  updateNotificationTrigger,
} from './service.js';
import { paginationSchema } from '../../lib/validation.js';
import Joi from 'joi';

const createTriggerSchema = Joi.object({
  eventId: Joi.string().required(),
  triggerType: Joi.string()
    .valid('REGISTRATION', 'GROUP_ASSIGNMENT', 'CENTER_ASSIGNMENT', 'EVENT_REMINDER')
    .required(),
  deliveryMethod: Joi.string().valid('EMAIL', 'SMS', 'PUSH').required(),
  templateId: Joi.string(),
  recipientType: Joi.string().valid('MEMBER', 'PARENT', 'ADMIN').required(),
});

const sendNotificationSchema = Joi.object({
  recipientId: Joi.string(),
  recipientEmail: Joi.string().email(),
  recipientPhone: Joi.string(),
  deliveryMethod: Joi.string().valid('EMAIL', 'SMS', 'PUSH').required(),
  subject: Joi.string().required(),
  message: Joi.string().required(),
  triggerType: Joi.string(),
});

/**
 * POST /api/notifications/triggers
 */
export const createTriggerHandler = async (req, res, next) => {
  try {
    const { error, value } = createTriggerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const trigger = await createNotificationTrigger(value);
    res.status(201).json({
      data: trigger,
      message: 'Notification trigger created',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/triggers/event/:eventId
 */
export const listTriggersHandler = async (req, res, next) => {
  try {
    const triggers = await listNotificationTriggers(req.params.eventId, {
      triggerType: req.query.triggerType,
      deliveryMethod: req.query.deliveryMethod,
    });

    res.status(200).json({
      data: triggers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/triggers/:triggerId
 */
export const getTriggerHandler = async (req, res, next) => {
  try {
    const trigger = await getNotificationTrigger(req.params.triggerId);
    res.status(200).json({
      data: trigger,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/triggers/:triggerId
 */
export const updateTriggerHandler = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'isActive is required',
        },
      });
    }

    const trigger = await updateNotificationTrigger(req.params.triggerId, {
      isActive,
    });

    res.status(200).json({
      data: trigger,
      message: 'Notification trigger updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/send
 */
export const sendNotificationHandler = async (req, res, next) => {
  try {
    const { error, value } = sendNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const notification = await sendNotification(value);
    res.status(201).json({
      data: notification,
      message: 'Notification sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/send-batch
 */
export const sendBatchHandler = async (req, res, next) => {
  try {
    const { recipients, deliveryMethod, subject, message, triggerType } = req.body;

    if (!recipients || !deliveryMethod || !subject || !message) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'recipients, deliveryMethod, subject, and message are required',
        },
      });
    }

    const result = await sendBatchNotifications({
      recipients,
      deliveryMethod,
      subject,
      message,
      triggerType,
    });

    res.status(200).json({
      data: result,
      message: `Sent ${result.sent} notifications`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/history
 */
export const getHistoryHandler = async (req, res, next) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const history = await getNotificationHistory({
      ...value,
      recipientId: req.query.recipientId,
      status: req.query.status,
      triggerType: req.query.triggerType,
    });

    res.status(200).json({
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/:notificationId/delivered
 */
export const markDeliveredHandler = async (req, res, next) => {
  try {
    const notification = await markNotificationAsDelivered(req.params.notificationId);
    res.status(200).json({
      data: notification,
      message: 'Notification marked as delivered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/trigger-registration/:registrationId
 */
export const triggerRegistrationHandler = async (req, res, next) => {
  try {
    const results = await triggerRegistrationNotifications(req.params.registrationId);
    res.status(200).json({
      data: results,
      message: 'Registration notifications triggered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/trigger-center-assignment/:registrationId
 */
export const triggerCenterAssignmentHandler = async (req, res, next) => {
  try {
    const results = await triggerCenterAssignmentNotifications(
      req.params.registrationId
    );
    res.status(200).json({
      data: results,
      message: 'Center assignment notifications triggered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/trigger-group-assignment/:registrationId
 */
export const triggerGroupAssignmentHandler = async (req, res, next) => {
  try {
    const results = await triggerGroupAssignmentNotifications(req.params.registrationId);
    res.status(200).json({
      data: results,
      message: 'Group assignment notifications triggered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/trigger-event-reminder/:eventId
 */
export const triggerEventReminderHandler = async (req, res, next) => {
  try {
    const result = await triggerEventReminderNotifications(req.params.eventId);
    res.status(200).json({
      data: result,
      message: 'Event reminder notifications triggered',
    });
  } catch (error) {
    next(error);
  }
};
