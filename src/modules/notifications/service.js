import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create notification trigger
 */
export const createNotificationTrigger = async (data) => {
  const {
    eventId,
    triggerType, // REGISTRATION | GROUP_ASSIGNMENT | CENTER_ASSIGNMENT | EVENT_REMINDER
    deliveryMethod, // EMAIL | SMS | PUSH
    templateId,
    recipientType, // MEMBER | PARENT | ADMIN
    isActive = true,
  } = data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const trigger = await prisma.notificationTrigger.create({
    data: {
      eventId,
      triggerType,
      deliveryMethod,
      templateId,
      recipientType,
      isActive,
      createdAt: new Date(),
    },
  });

  return trigger;
};

/**
 * Get notification trigger
 */
export const getNotificationTrigger = async (triggerId) => {
  const trigger = await prisma.notificationTrigger.findUnique({
    where: { id: triggerId },
  });

  if (!trigger) {
    throw new NotFoundError('Notification trigger not found');
  }

  return trigger;
};

/**
 * List notification triggers by event
 */
export const listNotificationTriggers = async (eventId, query = {}) => {
  const { triggerType, deliveryMethod } = query;

  const where = {
    eventId,
    ...(triggerType && { triggerType }),
    ...(deliveryMethod && { deliveryMethod }),
    isActive: true,
  };

  const triggers = await prisma.notificationTrigger.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return triggers;
};

/**
 * Send notification (email/SMS)
 */
export const sendNotification = async (data) => {
  const {
    recipientId,
    recipientEmail,
    recipientPhone,
    deliveryMethod, // EMAIL | SMS | PUSH
    subject,
    message,
    templateData = {},
    triggerType,
  } = data;

  // Create notification record
  const notification = await prisma.notification.create({
    data: {
      recipientId,
      deliveryMethod,
      subject,
      message,
      templateData,
      triggerType,
      status: 'PENDING',
      createdAt: new Date(),
    },
  });

  // Queue for actual sending (integration with email/SMS providers)
  await queueNotificationJob({
    notificationId: notification.id,
    recipientEmail,
    recipientPhone,
    deliveryMethod,
    subject,
    message,
  });

  return notification;
};

/**
 * Queue notification job (background worker)
 */
const queueNotificationJob = async (data) => {
  // This would integrate with a job queue (Bull, RabbitMQ, etc.)
  // For now, we just log it
  console.log('Notification queued:', data);

  // In production:
  // await notificationQueue.add(data, { attempts: 3, backoff: 'exponential' });
};

/**
 * Send batch notifications
 */
export const sendBatchNotifications = async (data) => {
  const {
    recipients,
    deliveryMethod,
    subject,
    message,
    templateData = {},
    triggerType,
  } = data;

  const notifications = [];

  for (const recipient of recipients) {
    try {
      const notification = await sendNotification({
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientPhone: recipient.phone,
        deliveryMethod,
        subject,
        message,
        templateData,
        triggerType,
      });

      notifications.push({
        recipientId: recipient.id,
        status: 'sent',
        notificationId: notification.id,
      });
    } catch (error) {
      notifications.push({
        recipientId: recipient.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return {
    sent: notifications.filter((n) => n.status === 'sent').length,
    failed: notifications.filter((n) => n.status === 'failed').length,
    details: notifications,
  };
};

/**
 * Get notification history
 */
export const getNotificationHistory = async (query = {}) => {
  const { page = 1, limit = 50, recipientId, status, triggerType } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(recipientId && { recipientId }),
    ...(status && { status }),
    ...(triggerType && { triggerType }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Trigger registration notifications
 */
export const triggerRegistrationNotifications = async (registrationId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      member: true,
      event: true,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found');
  }

  // Get notification triggers for this event
  const triggers = await listNotificationTriggers(registration.event.id, {
    triggerType: 'REGISTRATION',
  });

  const results = [];

  for (const trigger of triggers) {
    try {
      const notification = await sendNotification({
        recipientId: registration.member.id,
        recipientEmail: registration.member.email,
        recipientPhone: registration.member.phone,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Registration Confirmed - ${registration.event.name}`,
        message: `Your registration for ${registration.event.name} has been confirmed.`,
        triggerType: 'REGISTRATION',
      });

      results.push({
        triggerId: trigger.id,
        notificationId: notification.id,
        status: 'sent',
      });
    } catch (error) {
      results.push({
        triggerId: trigger.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Trigger center assignment notifications
 */
export const triggerCenterAssignmentNotifications = async (registrationId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      member: true,
      event: true,
      center: true,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found');
  }

  if (!registration.center) {
    return { message: 'No center assigned' };
  }

  const triggers = await listNotificationTriggers(registration.event.id, {
    triggerType: 'CENTER_ASSIGNMENT',
  });

  const results = [];

  for (const trigger of triggers) {
    try {
      const notification = await sendNotification({
        recipientId: registration.member.id,
        recipientEmail: registration.member.email,
        recipientPhone: registration.member.phone,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Center Assignment - ${registration.event.name}`,
        message: `You have been assigned to ${registration.center.name} for ${registration.event.name}.`,
        triggerType: 'CENTER_ASSIGNMENT',
      });

      results.push({
        triggerId: trigger.id,
        notificationId: notification.id,
        status: 'sent',
      });
    } catch (error) {
      results.push({
        triggerId: trigger.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Trigger group assignment notifications
 */
export const triggerGroupAssignmentNotifications = async (registrationId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      member: true,
      event: true,
      group: true,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found');
  }

  if (!registration.group) {
    return { message: 'No group assigned' };
  }

  const triggers = await listNotificationTriggers(registration.event.id, {
    triggerType: 'GROUP_ASSIGNMENT',
  });

  const results = [];

  for (const trigger of triggers) {
    try {
      const notification = await sendNotification({
        recipientId: registration.member.id,
        recipientEmail: registration.member.email,
        recipientPhone: registration.member.phone,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Group Assignment - ${registration.event.name}`,
        message: `You have been assigned to ${registration.group.name} for ${registration.event.name}.`,
        triggerType: 'GROUP_ASSIGNMENT',
      });

      results.push({
        triggerId: trigger.id,
        notificationId: notification.id,
        status: 'sent',
      });
    } catch (error) {
      results.push({
        triggerId: trigger.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Trigger event reminder notifications
 */
export const triggerEventReminderNotifications = async (eventId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Get all registrations for event
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    include: { member: true },
  });

  const triggers = await listNotificationTriggers(eventId, {
    triggerType: 'EVENT_REMINDER',
  });

  const results = [];

  for (const registration of registrations) {
    for (const trigger of triggers) {
      try {
        const notification = await sendNotification({
          recipientId: registration.member.id,
          recipientEmail: registration.member.email,
          recipientPhone: registration.member.phone,
          deliveryMethod: trigger.deliveryMethod,
          subject: `Reminder: ${event.name}`,
          message: `This is a reminder that ${event.name} is coming up on ${event.startDate}.`,
          triggerType: 'EVENT_REMINDER',
        });

        results.push({
          registrationId: registration.id,
          notificationId: notification.id,
          status: 'sent',
        });
      } catch (error) {
        results.push({
          registrationId: registration.id,
          status: 'failed',
          error: error.message,
        });
      }
    }
  }

  return {
    eventId,
    totalSent: results.filter((r) => r.status === 'sent').length,
    totalFailed: results.filter((r) => r.status === 'failed').length,
  };
};

/**
 * Mark notification as read/delivered
 */
export const markNotificationAsDelivered = async (notificationId) => {
  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
  });

  return notification;
};

/**
 * Update notification trigger status
 */
export const updateNotificationTrigger = async (triggerId, data) => {
  const trigger = await prisma.notificationTrigger.findUnique({
    where: { id: triggerId },
  });

  if (!trigger) {
    throw new NotFoundError('Notification trigger not found');
  }

  const { isActive } = data;

  const updated = await prisma.notificationTrigger.update({
    where: { id: triggerId },
    data: {
      ...(isActive !== undefined && { isActive }),
    },
  });

  return updated;
};
