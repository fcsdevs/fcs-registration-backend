import { getPrismaClient } from '../../lib/prisma.js';
import {
  generateFCSCode,
  getPaginationParams,
  formatPaginatedResponse,
} from '../../lib/helpers.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

/**
 * Create a new member
 */
export const createMember = async (data, userId) => {
  const { firstName, lastName, email, phoneNumber, dateOfBirth, gender, maritalStatus, occupation, state } = data;

  // Check if member with phone already exists
  if (phoneNumber) {
    const existingMember = await prisma.member.findFirst({
      where: { phoneNumber },
    });
    if (existingMember) {
      throw new ValidationError('Member with this phone number already exists');
    }
  }

  const member = await prisma.member.create({
    data: {
      fcsCode: generateFCSCode(),
      firstName,
      lastName,
      email: email || null,
      phoneNumber: phoneNumber || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: gender || null,
      maritalStatus: maritalStatus || null,
      occupation: occupation || null,
      state: state || null,
    },
  });

  return member;
};

/**
 * Get member by ID
 */
export const getMemberById = async (memberId) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      guardians: {
        include: {
          guardian: {
            select: {
              id: true,
              fcsCode: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
      guardianOf: {
        include: {
          member: {
            select: {
              id: true,
              fcsCode: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  return member;
};

/**
 * Get member by FCS code
 */
export const getMemberByFCSCode = async (fcsCode) => {
  const member = await prisma.member.findUnique({
    where: { fcsCode },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  return member;
};

/**
 * Get member by Auth User ID
 */
export const getMemberByAuthId = async (authUserId) => {
  const member = await prisma.member.findFirst({
    where: { authUserId },
  });

  if (!member) {
    throw new NotFoundError('Member profile');
  }

  return member;
};

/**
 * List all members with pagination and filters
 */
export const listMembers = async (query) => {
  const { page, limit, search, state, isActive, gender } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (gender) {
    where.gender = gender;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { fcsCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (state) {
    where.state = state;
  }

  // Scope Enforcement Logic
  if (query.unitId) {
    const scopeUnit = await prisma.unit.findUnique({
      where: { id: query.unitId },
      include: { unitType: true }
    });

    if (scopeUnit && scopeUnit.unitType) {
      const typeName = scopeUnit.unitType.name.toLowerCase();
      // Match unit name to member fields
      // This relies on matching names (e.g. Unit 'Lagos' => Member.state 'Lagos')
      if (typeName.includes('state')) {
        where.state = { contains: scopeUnit.name, mode: 'insensitive' };
      } else if (typeName.includes('zone')) {
        where.zone = { contains: scopeUnit.name, mode: 'insensitive' };
      } else if (typeName.includes('branch')) {
        where.branch = { contains: scopeUnit.name, mode: 'insensitive' };
      }
      // If National, no filter needed (unless we want to filter by country/region if added)
    }
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        fcsCode: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        gender: true,
        state: true,
        isActive: true,
        joinedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.member.count({ where }),
  ]);

  return formatPaginatedResponse(members, total, parseInt(page || 1), parseInt(limit || 20));
};

/**
 * Update member
 */
export const updateMember = async (memberId, data) => {
  const { firstName, lastName, email, phoneNumber, dateOfBirth, gender, maritalStatus, occupation, state } = data;

  // Check if member exists
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  // Check if new phone number is unique
  if (phoneNumber && phoneNumber !== member.phoneNumber) {
    const existingMember = await prisma.member.findFirst({
      where: { phoneNumber },
    });
    if (existingMember) {
      throw new ValidationError('Member with this phone number already exists');
    }
  }

  const updatedMember = await prisma.member.update({
    where: { id: memberId },
    data: {
      firstName: firstName || member.firstName,
      lastName: lastName || member.lastName,
      email: email !== undefined ? email : member.email,
      phoneNumber: phoneNumber || member.phoneNumber,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : member.dateOfBirth,
      gender: gender || member.gender,
      maritalStatus: maritalStatus || member.maritalStatus,
      occupation: occupation || member.occupation,
      state: state || member.state,
    },
  });

  return updatedMember;
};

/**
 * Add guardian to member
 */
export const addGuardian = async (memberId, guardianId, relationship) => {
  // Check both members exist
  const [member, guardian] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.member.findUnique({ where: { id: guardianId } }),
  ]);

  if (!member) {
    throw new NotFoundError('Member');
  }

  if (!guardian) {
    throw new NotFoundError('Guardian');
  }

  // Check if relationship already exists
  const existingRelationship = await prisma.guardian.findFirst({
    where: {
      memberId,
      guardianId,
    },
  });

  if (existingRelationship) {
    throw new ValidationError('Guardian relationship already exists');
  }

  const guardianRecord = await prisma.guardian.create({
    data: {
      memberId,
      guardianId,
      relationship,
    },
  });

  return guardianRecord;
};

/**
 * Remove guardian from member
 */
export const removeGuardian = async (memberId, guardianId) => {
  const relationship = await prisma.guardian.findFirst({
    where: {
      memberId,
      guardianId,
    },
  });

  if (!relationship) {
    throw new NotFoundError('Guardian relationship');
  }

  await prisma.guardian.delete({
    where: { id: relationship.id },
  });

  return { message: 'Guardian removed successfully' };
};

/**
 * Get member attendance summary
 */
export const getMemberAttendanceSummary = async (memberId) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  const [totalRegistrations, totalAttendance, attendanceByMode] = await Promise.all([
    prisma.registration.count({
      where: { memberId },
    }),
    prisma.attendanceRecord.count({
      where: { memberId },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['participationMode'],
      where: { memberId },
      _count: true,
    }),
  ]);

  return {
    memberId,
    fcsCode: member.fcsCode,
    name: `${member.firstName} ${member.lastName}`,
    totalRegistrations,
    totalAttendance,
    attendanceByMode: attendanceByMode.map((item) => ({
      mode: item.participationMode,
      count: item._count,
    })),
    attendanceRate: totalRegistrations > 0 ? Math.round((totalAttendance / totalRegistrations) * 100) : 0,
  };
};

/**
 * Deactivate member
 */
export const deactivateMember = async (memberId) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member');
  }

  return prisma.member.update({
    where: { id: memberId },
    data: { isActive: false },
  });
};

/**
 * Search members by name or FCS code
 */
export const searchMembers = async (query) => {
  const members = await prisma.member.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { fcsCode: { contains: query, mode: 'insensitive' } },
      ],
      isActive: true,
    },
    select: {
      id: true,
      fcsCode: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      email: true,
    },
    take: 20,
  });

  return members;
};
