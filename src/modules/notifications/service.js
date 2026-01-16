import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError } from '../../middleware/error-handler.js';
import { getEffectiveScope } from '../users/service.js';

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
      eventId: data.eventId,
      recipientId,
      recipientEmail,
      recipientPhone,
      deliveryMethod,
      subject,
      message,
      templateData,
      triggerType: triggerType || 'GENERAL',
      status: 'PENDING',
      createdAt: new Date(),
    },
  });

  // Queue for actual sending (integration with email/SMS providers)
  await queueNotificationJob(notification.id, {
    recipientEmail,
    recipientPhone,
    deliveryMethod,
    subject,
    message,
  });

  return notification;
};

import { sendMail } from '../../lib/mail.js';

/**
 * Queue notification job (background worker)
 */
const queueNotificationJob = async (id, data) => {
  // Execute asynchronously 
  setTimeout(async () => {
    try {
      console.log(`[Worker] Processing notification ${id} (${data.deliveryMethod})`);

      let sentResult = null;
      if (data.deliveryMethod === 'EMAIL') {
        sentResult = await sendMail({
          to: data.recipientEmail,
          subject: data.subject,
          text: data.message,
          html: data.message.replace(/\n/g, '<br/>'),
        });
      }

      // Update status to SENT
      await prisma.notification.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        }
      });
      console.log(`[Worker] Notification ${id} sent successfully`);
    } catch (error) {
      console.error(`[Worker] Failed to send notification ${id}:`, error);
      await prisma.notification.update({
        where: { id },
        data: {
          status: 'FAILED',
          failureReason: error.message,
        }
      });
    }
  }, 0);
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
    eventId,
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
        eventId,
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
  const { page = 1, limit = 50, recipientId, status, triggerType, userId } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status }),
    ...(triggerType && { triggerType }),
  };

  // Enforce recipient check for non-admins
  if (userId) {
    const scope = await getEffectiveScope(userId);
    if (!scope.isGlobal && !scope.unitId) {
      // Basic User: fetch their member record
      const member = await prisma.member.findFirst({
        where: { authUserId: userId },
        select: { id: true },
      });
      if (member) {
        where.recipientId = member.id;
      } else {
        // If no member record, they see nothing
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
    } else {
      // Admin: can filter by recipientId if provided
      if (recipientId) {
        where.recipientId = recipientId;
      }
    }
  } else if (recipientId) {
    where.recipientId = recipientId;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            fcsCode: true,
          },
        },
        event: {
          select: {
            title: true,
          },
        },
      },
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
        recipientPhone: registration.member.phoneNumber || registration.member.whatsappNumber,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Registration Confirmed - ${registration.event.title}`,
        message: `Your registration for ${registration.event.title} has been confirmed.`,
        triggerType: 'REGISTRATION',
        eventId: registration.event.id,
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
        recipientPhone: registration.member.phoneNumber || registration.member.whatsappNumber,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Center Assignment - ${registration.event.title}`,
        message: `You have been assigned to ${registration.center.centerName} for ${registration.event.title}.`,
        triggerType: 'CENTER_ASSIGNMENT',
        eventId: registration.event.id,
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
        recipientPhone: registration.member.phoneNumber || registration.member.whatsappNumber,
        deliveryMethod: trigger.deliveryMethod,
        subject: `Group Assignment - ${registration.event.title}`,
        message: `You have been assigned to ${registration.group.name} for ${registration.event.title}.`,
        triggerType: 'GROUP_ASSIGNMENT',
        eventId: registration.event.id,
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
          recipientPhone: registration.member.phoneNumber || registration.member.whatsappNumber,
          deliveryMethod: trigger.deliveryMethod,
          subject: `Reminder: ${event.title}`,
          message: `This is a reminder that ${event.title} is coming up on ${event.startDate}.`,
          triggerType: 'EVENT_REMINDER',
          eventId: event.id,
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
