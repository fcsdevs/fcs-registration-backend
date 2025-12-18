import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, AppError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create event group
 */
export const createGroup = async (data) => {
  const { eventId, name, type, description, capacity, isActive = true } = data;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const group = await prisma.eventGroup.create({
    data: {
      eventId,
      name,
      type, // BIBLE_STUDY | WORKSHOP | BREAKOUT
      description,
      capacity,
      isActive,
    },
  });

  return group;
};

/**
 * Get group by ID
 */
export const getGroupById = async (groupId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      event: true,
      registrations: {
        include: {
          member: true,
        },
      },
      _count: {
        select: { registrations: true },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  return group;
};

/**
 * List groups for event
 */
export const listGroupsByEvent = async (eventId, query = {}) => {
  const { page = 1, limit = 50, type, isActive = true } = query;
  const skip = (page - 1) * limit;

  const where = {
    eventId,
    ...(type && { type }),
    ...(isActive !== null && { isActive }),
  };

  const [groups, total] = await Promise.all([
    prisma.eventGroup.findMany({
      where,
      include: {
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.eventGroup.count({ where }),
  ]);

  return {
    data: groups.map((g) => ({
      ...g,
      memberCount: g._count.registrations,
      spotsAvailable: g.capacity ? Math.max(0, g.capacity - g._count.registrations) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update group
 */
export const updateGroup = async (groupId, data) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const { name, description, capacity, isActive } = data;

  const updated = await prisma.eventGroup.update({
    where: { id: groupId },
    data: {
      ...(name && { name }),
      ...(description && { description }),
      ...(capacity && { capacity }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      _count: {
        select: { registrations: true },
      },
    },
  });

  return {
    ...updated,
    memberCount: updated._count.registrations,
  };
};

/**
 * Assign member to group
 */
export const assignMemberToGroup = async (groupId, memberId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      _count: {
        select: { registrations: true },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Check capacity
  if (group.capacity && group._count.registrations >= group.capacity) {
    throw new AppError('Group is at full capacity', 400);
  }

  // Find registration for this member in this event
  const registration = await prisma.registration.findFirst({
    where: {
      memberId,
      eventId: group.eventId,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found for member in this event');
  }

  // Update registration with group
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { groupId },
    include: {
      member: true,
      group: true,
    },
  });

  return updated;
};

/**
 * Remove member from group
 */
export const removeMemberFromGroup = async (groupId, memberId) => {
  // Find registration
  const registration = await prisma.registration.findFirst({
    where: {
      memberId,
      groupId,
    },
  });

  if (!registration) {
    throw new NotFoundError('Member not found in group');
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { groupId: null },
    include: {
      member: true,
    },
  });

  return updated;
};

/**
 * Get group members
 */
export const getGroupMembers = async (groupId, query = {}) => {
  const { page = 1, limit = 50 } = query;
  const skip = (page - 1) * limit;

  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const [members, total] = await Promise.all([
    prisma.registration.findMany({
      where: { groupId },
      include: {
        member: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.registration.count({ where: { groupId } }),
  ]);

  return {
    data: members.map((m) => ({
      registrationId: m.id,
      member: m.member,
      participationMode: m.participationMode,
      joinedAt: m.createdAt,
    })),
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
      capacity: group.capacity,
      memberCount: total,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Bulk assign members to groups (auto-assignment or manual)
 */
export const bulkAssignGroups = async (eventId, assignments, strategy = 'manual') => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  let results = {
    assigned: 0,
    failed: 0,
    errors: [],
  };

  if (strategy === 'manual') {
    // Manual assignments provided in array
    for (const assignment of assignments) {
      try {
        await assignMemberToGroup(assignment.groupId, assignment.memberId);
        results.assigned++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          groupId: assignment.groupId,
          memberId: assignment.memberId,
          error: error.message,
        });
      }
    }
  } else if (strategy === 'auto') {
    // Auto-distribute members to groups evenly
    const groups = await prisma.eventGroup.findMany({
      where: { eventId, isActive: true },
    });

    const registrations = await prisma.registration.findMany({
      where: {
        eventId,
        groupId: null,
      },
    });

    let groupIndex = 0;
    for (const reg of registrations) {
      const targetGroup = groups[groupIndex % groups.length];
      try {
        await prisma.registration.update({
          where: { id: reg.id },
          data: { groupId: targetGroup.id },
        });
        results.assigned++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          registrationId: reg.id,
          error: error.message,
        });
      }
      groupIndex++;
    }
  }

  return results;
};

/**
 * Get group statistics
 */
export const getGroupStatistics = async (groupId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
    include: {
      _count: {
        select: { registrations: true },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Get attendance for group members
  const groupAttendance = await prisma.attendanceRecord.findMany({
    where: {
      registration: {
        groupId,
      },
    },
    include: {
      registration: {
        include: {
          member: true,
        },
      },
    },
  });

  const attendanceByMode = {};
  groupAttendance.forEach((a) => {
    const mode = a.participationMode;
    attendanceByMode[mode] = (attendanceByMode[mode] || 0) + 1;
  });

  const capacityUtilization = group.capacity
    ? (group._count.registrations / group.capacity) * 100
    : 0;

  const attendanceRate =
    group._count.registrations > 0
      ? (groupAttendance.length / group._count.registrations) * 100
      : 0;

  return {
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
    },
    statistics: {
      totalMembers: group._count.registrations,
      totalAttendance: groupAttendance.length,
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
      capacityUtilization: group.capacity
        ? parseFloat(capacityUtilization.toFixed(2))
        : null,
    },
    attendanceByMode: Object.entries(attendanceByMode).map(([mode, count]) => ({
      mode,
      count,
    })),
  };
};

/**
 * Deactivate group
 */
export const deactivateGroup = async (groupId) => {
  const group = await prisma.eventGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Unassign all members
  await prisma.registration.updateMany({
    where: { groupId },
    data: { groupId: null },
  });

  const updated = await prisma.eventGroup.update({
    where: { id: groupId },
    data: { isActive: false },
  });

  return updated;
};
