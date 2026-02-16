import { getPrismaClient } from '../../lib/prisma.js';
import {
  getPaginationParams,
  formatPaginatedResponse,
} from '../../lib/helpers.js';
import { checkScopeAccess } from '../users/service.js';
import { getAllDescendantIds } from '../units/service.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../middleware/error-handler.js';
import { isRegistrationOpen } from '../events/service.js';
import { assignToBibleStudy } from '../groups/service.js';

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

  // If on-site or hybrid, center is required
  const finalParticipationMode = participationMode || 'ONLINE';
  if ((finalParticipationMode === 'ONSITE' || finalParticipationMode === 'HYBRID') && !centerId) {
    throw new ValidationError('Center is required for on-site or hybrid participation');
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
      attendanceIntent: data.attendanceIntent || 'CONFIRMED',
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
      groupAssignments: {
        include: {
          group: true,
        },
      },
    },
  });

  // Auto-assign to Bible Study if available
  try {
    await assignToBibleStudy(eventId, registration.id, memberId, userId);
  } catch (error) {
    // Log error but don't fail registration
    console.error(`[AutoAssignment] Failed for registration ${registration.id}:`, error);
  }

  return registration;
};

/**
 * Get registration by ID
 */
export const getRegistrationById = async (registrationId, userId) => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      member: {
        select: {
          id: true,
          authUserId: true, // Added for ownership check
          fcsCode: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          profilePhotoUrl: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          participationMode: true,
          startDate: true,
          endDate: true,
          imageUrl: true,
          unitId: true, // Added for scope check
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
      groupAssignments: {
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

  // Permission Check
  if (userId) {
    const isOwner = registration.member.authUserId === userId;
    const isRegistrar = registration.registeredBy === userId;

    if (!isOwner && !isRegistrar) {
      // Check if Admin Scope allows
      const hasAdminAccess = await checkScopeAccess(userId, registration.event.unitId);
      if (!hasAdminAccess) {
        throw new ForbiddenError('You do not have permission to view this registration');
      }
    }
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
    // Advanced Search Logic: Split search terms and search each part
    const searchParts = search.trim().split(/\s+/);
    const searchConditions = [
      { id: { equals: search } }, // Exact match for ID (CUID)
      { member: { email: { contains: search, mode: 'insensitive' } } },
      { member: { phoneNumber: { contains: search } } },
      { member: { fcsCode: { contains: search, mode: 'insensitive' } } },
      { member: { otherNames: { contains: search, mode: 'insensitive' } } },
      { member: { ageBracket: { contains: search, mode: 'insensitive' } } },
      // Search each part against firstName
      ...searchParts.map(part => ({
        member: { firstName: { contains: part, mode: 'insensitive' } }
      })),
      // Search each part against lastName
      ...searchParts.map(part => ({
        member: { lastName: { contains: part, mode: 'insensitive' } }
      })),
      // Search each part against otherNames (middle names)
      ...searchParts.map(part => ({
        member: { otherNames: { contains: part, mode: 'insensitive' } }
      })),
    ];

    // Smart DOB Search: If search looks like a year (4 digits), search by birth year
    const yearMatch = search.match(/\b(19\d{2}|20\d{2})\b/); // Matches years 1900-2099
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

      searchConditions.push({
        member: {
          dateOfBirth: {
            gte: yearStart,
            lte: yearEnd
          }
        }
      });
    }

    // Combine with existing filters using AND logic if needed
    if (Object.keys(where).length > 0) {
      where.AND = [
        { OR: searchConditions }
      ];
    } else {
      where.OR = searchConditions;
    }
  }


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
            phoneNumber: true,
            profilePhotoUrl: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            participationMode: true,
            imageUrl: true
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
        groupAssignments: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }
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

  // Check if already assigned to a group of the same type for this registration
  const sameTypeAssignment = await prisma.groupAssignment.findFirst({
    where: {
      registrationId,
      group: {
        type: group.type
      }
    },
  });

  if (sameTypeAssignment) {
    // Update existing assignment of same type
    return prisma.groupAssignment.update({
      where: { id: sameTypeAssignment.id },
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
    include: { event: true, member: true },
  });

  if (!registration) {
    throw new NotFoundError('Registration');
  }

  if (userId) {
    const isSelf = registration.member.authUserId === userId;
    const isRegistrar = registration.registeredBy === userId;

    if (!isSelf && !isRegistrar) {
      const hasAccess = await checkScopeAccess(userId, registration.event.unitId);
      if (!hasAccess) throw new ForbiddenError('You do not have permission to cancel this registration');
    }
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
 * Check if a member is already registered for an event
 */
export const checkRegistrationStatus = async (eventId, memberId) => {
  // Check if registration exists
  const existingRegistration = await prisma.registration.findFirst({
    where: {
      eventId,
      memberId,
      status: { not: 'CANCELLED' } // Exclude cancelled registrations
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
        }
      },
      participation: {
        include: {
          center: {
            select: {
              id: true,
              centerName: true,
            }
          }
        }
      }
    }
  });

  if (existingRegistration) {
    return {
      isRegistered: true,
      registration: existingRegistration,
      message: `This member is already registered for ${existingRegistration.event.title}`
    };
  }

  return {
    isRegistered: false,
    registration: null,
    message: 'Member is not registered for this event'
  };
};

export const getRegistrarStatistics = async (eventId, registrarId, centerId) => {
  // 1. Registered By Me
  const registeredByMe = await prisma.registration.count({
    where: {
      eventId,
      OR: [
        { registeredBy: registrarId },
        { member: { authUserId: registrarId } }
      ]
    }
  });

  // 2. Infer centerId if missing
  let effectiveCenterId = centerId;
  if (!effectiveCenterId) {
    const centerAdmin = await prisma.centerAdmin.findFirst({
      where: {
        userId: registrarId,
        center: { eventId }
      }
    });
    if (centerAdmin) {
      effectiveCenterId = centerAdmin.centerId;
    }
  }

  // 3. Center Stats (if centerId/effectiveCenterId provided)
  let centerStats = {
    totalRegistered: 0,
    totalConfirmed: 0,
    totalCheckedIn: 0
  };

  if (effectiveCenterId) {
    const [total, confirmed, checkedIn] = await Promise.all([
      prisma.registration.count({ where: { eventId, centerId: effectiveCenterId } }),
      prisma.registration.count({ where: { eventId, centerId: effectiveCenterId, status: 'CONFIRMED' } }),
      prisma.registration.count({ where: { eventId, centerId: effectiveCenterId, status: 'CHECKED_IN' } })
    ]);
    centerStats = { totalRegistered: total, totalConfirmed: confirmed, totalCheckedIn: checkedIn };
  }

  return {
    registeredByMe,
    centerStats
  };
};

/**
 * Get Global Registration Statistics Summary
 */
export const getGlobalRegistrationsStats = async (query = {}) => {
  const { eventId, unitId } = query;
  const where = {};

  if (eventId) {
    where.eventId = eventId;
  }

  if (unitId) {
    const descendants = await getAllDescendantIds(unitId);
    const allUnitIds = [unitId, ...descendants];
    where.event = { unitId: { in: allUnitIds } };
  }

  const [total, confirmed, pending, checkedIn] = await Promise.all([
    prisma.registration.count({ where }),
    // Confirmed are those with CONFIRMED status who HAVEN'T checked in yet
    prisma.registration.count({
      where: {
        ...where,
        status: 'CONFIRMED',
        attendance: { is: null }
      }
    }),
    prisma.registration.count({ where: { ...where, status: 'PENDING' } }),
    // Checked in are those with either the status or an actual attendance record
    prisma.registration.count({
      where: {
        ...where,
        OR: [
          { status: 'CHECKED_IN' },
          { attendance: { isNot: null } }
        ]
      }
    }),
  ]);

  return {
    total,
    confirmed,
    pending,
    checkedIn
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

  // Check if attendance already exists
  const existingAttendance = await prisma.attendanceRecord.findUnique({
    where: { registrationId }
  });

  if (!existingAttendance) {
    // Create attendance record to sync with reports
    await prisma.attendanceRecord.create({
      data: {
        eventId: registration.eventId,
        registrationId: registration.id,
        memberId: registration.memberId,
        participationMode: registration.participation?.participationMode || 'ONSITE', // Fallback
        checkInMethod: method || 'MANUAL',
        checkInTime: new Date(),
      }
    });
  }

  return prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: 'CHECKED_IN',
    }
  });
};

/**
 * Export Registrations to CSV
 */
export const exportRegistrationsToCSV = async (query) => {
  const { Parser } = await import('json2csv');

  // Get all registrations without pagination
  const { page, limit, ...filterQuery } = query;
  const registrations = await listRegistrations({
    ...filterQuery,
    page: 1,
    limit: 10000, // Large limit to get all records
  });

  // Flatten the data for CSV
  const flattenedData = registrations.data.map(reg => ({
    'Registration ID': reg.id,
    'Registration Date': new Date(reg.registrationDate).toLocaleString(),
    'Status': reg.status,
    'Attendance Intent': reg.attendanceIntent || 'CONFIRMED',

    // Member Info
    'FCS Code': reg.member?.fcsCode || '',
    'First Name': reg.member?.firstName || '',
    'Last Name': reg.member?.lastName || '',
    'Email': reg.member?.email || '',
    'Phone': reg.member?.phoneNumber || '',

    // Event Info
    'Event ID': reg.event?.id || '',
    'Event Title': reg.event?.title || '',
    'Event Start Date': reg.event?.startDate ? new Date(reg.event.startDate).toLocaleDateString() : '',
    'Event End Date': reg.event?.endDate ? new Date(reg.event.endDate).toLocaleDateString() : '',
    'Event Mode': reg.event?.participationMode || '',

    // Participation Info
    'Participation Mode': reg.participation?.participationMode || '',
    'Center Name': reg.participation?.center?.centerName || reg.center?.centerName || '',
    'Center Address': reg.participation?.center?.address || reg.center?.address || '',

    // Group Info
    'Bible Study': reg.groupAssignments?.find(ga => ga.group?.type === 'BIBLE_STUDY')?.group?.name || '',
    'Workshop': reg.groupAssignments?.find(ga => ga.group?.type === 'WORKSHOP')?.group?.name || '',
    'Seminar': reg.groupAssignments?.find(ga => ga.group?.type === 'SEMINAR')?.group?.name || '',

    // Additional
    'Cancelled At': reg.cancelledAt ? new Date(reg.cancelledAt).toLocaleString() : '',
    'Cancellation Reason': reg.cancellationReason || '',
  }));

  // Define fields for CSV
  const fields = [
    'Registration ID',
    'Registration Date',
    'Status',
    'Attendance Intent',
    'FCS Code',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Event ID',
    'Event Title',
    'Event Start Date',
    'Event End Date',
    'Event Mode',
    'Participation Mode',
    'Center Name',
    'Center Address',
    'Bible Study',
    'Workshop',
    'Seminar',
    'Cancelled At',
    'Cancellation Reason',
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(flattenedData);

  return csv;
};
