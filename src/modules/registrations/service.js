import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPaginationParams,
  formatPaginatedResponse,
} from '../../lib/helpers.js';
import { checkScopeAccess, getAllDescendantIds } from '../users/service.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../middleware/error-handler.js';
import { isRegistrationOpen } from '../events/service.js';

const prisma = getPrismaClient();

/**
 * Create registration
 */
export const createRegistration = async (data, userId) => {
  const { eventId, memberId, centerId, participationMode } = data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { settings: true },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  // Verify member exists
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  // Permission Check - DISABLED AS REQUESTED
  // We are allowing all registrations to proceed without scope/permission checks
  /*
    const isSelfRegistration = member.authUserId === userId;
  
    if (isSelfRegistration) {
      if (event.settings && event.settings.allowSelfRegistration === false) {
        throw new ForbiddenError('Self-registration is not enabled for this event');
      }
    } else {
      // Check if third-party registration is explicitly allowed
      const allowThirdParty = event.settings?.allowThirdPartyRegistration ?? false;
  
      if (!allowThirdParty) {
        const hasAccess = await checkScopeAccess(userId, event.unitId);
        if (!hasAccess) {
          throw new ForbiddenError('You do not have permission to register members for this event');
        }
      }
    }
    */

  if (!isRegistrationOpen(event)) {
    throw new ValidationError('Registration window is closed for this event');
  }

  // Check if already registered
  const existingRegistration = await prisma.registration.findFirst({
    where: { eventId, memberId },
  });

  if (existingRegistration) {
    throw new ValidationError('Member is already registered for this event');
  }

  // If on-site, center is required
  const finalParticipationMode = participationMode || 'ONLINE';
  if (finalParticipationMode === 'ONSITE' && !centerId) {
    throw new ValidationError('Center is required for on-site participation');
  }

  // Verify center if provided
  if (centerId) {
    const center = await prisma.eventCenter.findUnique({
      where: { id: centerId },
    });

    if (!center || !center.isActive) {
      throw new ValidationError('Selected center is not available');
    }

    // Check capacity
    if (center.capacity) {
      const registrationCount = await prisma.registration.count({
        where: { centerId },
      });
      if (registrationCount >= center.capacity) {
        throw new ValidationError('Center has reached maximum capacity');
      }
    }
  }

  // Create registration
  const registration = await prisma.registration.create({
    data: {
      eventId,
      memberId,
      centerId: centerId || null,
      registeredBy: userId,
      status: 'CONFIRMED',
      participation: {
        create: {
          participationMode: finalParticipationMode,
          centerId: centerId || null,
          assignedBy: userId,
        },
      },
    },
    include: {
      participation: true,
      member: {
        select: {
          fcsCode: true,
          firstName: true,
          lastName: true,
        },
      },
      event: {
        select: {
          title: true,
          participationMode: true,
        },
      },
    },
  });

  return registration;
};

/**
 * Get registration by ID
 */
export const getRegistrationById = async (registrationId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      member: {
        select: {
          id: true,
          fcsCode: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          participationMode: true,
          startDate: true,
          endDate: true,
        },
      },
      participation: {
        include: {
          center: {
            select: {
              id: true,
              centerName: true,
              address: true,
            },
          },
        },
      },
      groupAssignment: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  return registration;
};

/**
 * List registrations with filters
 */
export const listRegistrations = async (query) => {
  const { page, limit, eventId, memberId, status, centerId, unitId, search, registeredBy, ids } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {};

  if (eventId) where.eventId = eventId;
  if (memberId) where.memberId = memberId;
  if (status) where.status = status;
  if (centerId) where.centerId = centerId;
  if (registeredBy) where.registeredBy = registeredBy;
  if (ids) {
    const idList = typeof ids === 'string' ? ids.split(',') : ids;
    where.id = { in: idList };
  }

  if (unitId) {
    const descendants = await getAllDescendantIds(unitId);
    const allUnitIds = [unitId, ...descendants];
    where.event = { unitId: { in: allUnitIds } };
  }

  if (search) {
    where.OR = [
      { id: { equals: search } }, // Exact match for ID (CUID)
      { member: { firstName: { contains: search, mode: 'insensitive' } } },
      { member: { lastName: { contains: search, mode: 'insensitive' } } },
      { member: { email: { contains: search, mode: 'insensitive' } } },
      { member: { phoneNumber: { contains: search, mode: 'insensitive' } } },
      { member: { fcsCode: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take,
      include: {
        member: { select: { fcsCode: true, firstName: true, lastName: true } },
        event: { select: { title: true, startDate: true, endDate: true, participationMode: true } },
        participation: {
          include: {
            center: true
          }
        },
      },
      orderBy: { registrationDate: 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  return formatPaginatedResponse(registrations, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Update registration status
 */
export const updateRegistrationStatus = async (registrationId, status, reason, userId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (userId) {
    const hasAccess = await checkScopeAccess(userId, registration.event.unitId);
    if (!hasAccess) throw new ForbiddenError('You do not have permission to update this registration');
  }

  const updateData = { status };

  if (status === 'CANCELLED') {
    updateData.cancelledAt = new Date();
    updateData.cancellationReason = reason || null;
  }

  return prisma.registration.update({
    where: { id: registrationId },
    data: updateData,
  });
};

/**
 * Assign center to registration
 */
export const assignCenter = async (registrationId, centerId, participationMode, userId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { participation: true, event: true },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (userId) {
    const hasAccess = await checkScopeAccess(userId, registration.event.unitId);
    if (!hasAccess) throw new ForbiddenError('You do not have permission to update this registration');
  }

  // Verify center exists and is active
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
  });

  if (!center || !center.isActive) {
    throw new ValidationError('Center is not available');
  }

  // Check capacity
  if (center.capacity) {
    const registrationCount = await prisma.registration.count({
      where: { centerId },
    });
    if (registrationCount >= center.capacity) {
      throw new ValidationError('Center has reached maximum capacity');
    }
  }

  // Update registration center
  await prisma.registration.update({
    where: { id: registrationId },
    data: { centerId },
  });

  // Update or create participation
  if (registration.participation) {
    return prisma.registrationParticipation.update({
      where: { registrationId },
      data: {
        participationMode: participationMode || registration.participation.participationMode,
        centerId: centerId || null,
        assignedBy: userId,
        assignedAt: new Date(),
      },
    });
  }

  return prisma.registrationParticipation.create({
    data: {
      registrationId,
      participationMode: participationMode || 'ONSITE',
      centerId: centerId || null,
      assignedBy: userId,
    },
  });
};

/**
 * Assign group to registration
 */
export const assignGroup = async (registrationId, groupId, userId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (userId) {
    const hasAccess = await checkScopeAccess(userId, registration.event.unitId);
    if (!hasAccess) throw new ForbiddenError('You do not have permission to update this registration');
  }

  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundError('Group');
  }

  if (group.capacity) {
    const assignmentCount = await prisma.groupAssignment.count({
      where: { groupId },
    });
    if (assignmentCount >= group.capacity) {
      throw new ValidationError('Group has reached maximum capacity');
    }
  }

  // Check if already assigned to a group for this event
  const existingAssignment = await prisma.groupAssignment.findFirst({
    where: { registrationId },
  });

  if (existingAssignment) {
    // Update existing
    return prisma.groupAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        groupId,
        assignedBy: userId,
        assignedAt: new Date(),
      },
    });
  }

  return prisma.groupAssignment.create({
    data: {
      groupId,
      registrationId,
      memberId: registration.memberId,
      assignedBy: userId,
    },
  });
};

/**
 * Cancel registration
 */
export const cancelRegistration = async (registrationId, reason, userId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (userId) {
    const hasAccess = await checkScopeAccess(userId, registration.event.unitId);
    if (!hasAccess) throw new ForbiddenError('You do not have permission to cancel this registration');
  }

  if (registration.status === 'CANCELLED') {
    throw new ValidationError('Registration is already cancelled');
  }

  return prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason || null,
    },
  });
};

/**
 * Get registrations by event
 */
export const getRegistrationsByEvent = async (eventId, query) => {
  const { page, limit, centerId, status } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = { eventId };
  if (centerId) where.centerId = centerId;
  if (status) where.status = status;

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take,
      include: {
        member: { select: { fcsCode: true, firstName: true, lastName: true } },
        participation: true,
      },
      orderBy: { registrationDate: 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  return formatPaginatedResponse(registrations, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Get member registrations
 */
export const getMemberRegistrations = async (memberId, query) => {
  const { page, limit, eventId, status } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = { memberId };
  if (eventId) where.eventId = eventId;
  if (status) where.status = status;

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      skip,
      take,
      include: {
        member: {
          select: {
            id: true,
            fcsCode: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            participationMode: true
          }
        },
        participation: {
          include: {
            center: {
              select: {
                id: true,
                centerName: true,
                address: true
              }
            }
          }
        },
      },
      orderBy: { registrationDate: 'desc' },
    }),
    prisma.registration.count({ where }),
  ]);

  return formatPaginatedResponse(registrations, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Get Registrar Statistics
 */
export const getRegistrarStatistics = async (eventId, registrarId, centerId) => {
  // 1. Registered By Me
  const registeredByMe = await prisma.registration.count({
    where: {
      eventId,
      registeredBy: registrarId
    }
  });

  // 2. Center Stats (if centerId provided)
  let centerStats = {
    totalRegistered: 0,
    totalConfirmed: 0,
    totalCheckedIn: 0
  };

  if (centerId) {
    const [total, confirmed, checkedIn] = await Promise.all([
      prisma.registration.count({ where: { eventId, centerId } }),
      prisma.registration.count({ where: { eventId, centerId, status: 'CONFIRMED' } }),
      prisma.registration.count({ where: { eventId, centerId, status: 'CHECKED_IN' } })
    ]);
    centerStats = { totalRegistered: total, totalConfirmed: confirmed, totalCheckedIn: checkedIn };
  }

  return {
    registeredByMe,
    centerStats
  };
};

/**
 * Mark Attendance
 */
export const markAttendance = async (registrationId, method, userId) => {
  // Verify registration exists
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { event: true }
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  // Permission check?
  // Ideally checks if userId (Registrar) has access to this event/center.
  // We'll rely on controller to pass userId and assume Basic Role checks are done there or globally.

  return prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: 'CHECKED_IN',
      // We could store metadata about "method" (KIOSK/SCAN) in a JSON field if schema supported it.
      // For now, status update is sufficient.
    }
  });
};
