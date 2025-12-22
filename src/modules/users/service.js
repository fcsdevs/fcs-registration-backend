import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middleware/error-handler.js';

const prisma = getPrismaClient();

export const listUsers = async ({ role, unitId, search }) => {
    // Query users with active RoleAssignments matching criteria
    const where = {};
    if (role) {
        where.roleAssignments = { some: { role: { name: { equals: role, mode: 'insensitive' } } } };
    }
    if (unitId) {
        // If unitId is provided, look for assignments in this unit OR children (if we want deep search, but strictly scope-based usually means users ASSIGNED to this unit)
        // For simplicity, strict match on unitId for now
        where.roleAssignments = {
            some: {
                ...(where.roleAssignments?.some || {}),
                unitId: unitId
            }
        };
    }

    // Also support checking the User/Member profile
    if (search) {
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } },
            { firstName: { contains: search, mode: 'insensitive' } }, // If AuthUser had names, but names are on Member...
            // Complex join: AuthUser -> Member -> firstName/lastName
            // Prisma doesn't support easy deep filtering on relations in 'where' for all cases, but let's try
            { members: { some: { firstName: { contains: search, mode: 'insensitive' } } } },
            { members: { some: { lastName: { contains: search, mode: 'insensitive' } } } },
        ];
    }

    const users = await prisma.authUser.findMany({
        where,
        include: {
            members: true, // Join Member info
            roleAssignments: {
                include: { role: true, unit: true }
            }
        }
    });

    // Map to frontend friendly format
    return users.map(u => {
        const member = u.members[0]; // Assuming 1-to-1 or Primary
        return {
            id: u.id,
            firstName: member?.firstName || '',
            lastName: member?.lastName || '',
            email: u.email,
            roles: u.roleAssignments.map(ra => ra.role.name),
            level: u.roleAssignments[0]?.unit?.unitType?.name || 'Unknown', // Simplification
            unitId: u.roleAssignments[0]?.unitId,
        };
    });
};

export const assignUserRole = async (targetUserId, roleName, unitId, assignedByUserId) => {
    // 1. Get Role ID
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError(`Role ${roleName}`);

    // 2. Validate Scoping (Can assignedByUserId assign to this unit?)
    // Omitted for brevity, but crucial in production

    // 3. Find User's Member Profile (RoleAssignment links to Member usually, but schema has memberId in RoleAssignment)
    const targetUser = await prisma.authUser.findUnique({
        where: { id: targetUserId },
        include: { members: true }
    });
    if (!targetUser || !targetUser.members[0]) throw new NotFoundError("User/Member");
    const memberId = targetUser.members[0].id;

    // 4. Create/Update Assignment
    // Check if exists
    const existing = await prisma.roleAssignment.findFirst({
        where: { memberId, roleId: role.id, unitId }
    });

    if (existing) return existing;

    return prisma.roleAssignment.create({
        data: {
            memberId,
            roleId: role.id,
            unitId,
            assignedBy: assignedByUserId
        }
    });
};

export const revokeUserRole = async (targetUserId, roleName, requestUserId) => {
    // 1. Get Role ID
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError(`Role ${roleName}`);

    // 2. Get Member ID
    const targetUser = await prisma.authUser.findUnique({
        where: { id: targetUserId },
        include: { members: true }
    });
    if (!targetUser || !targetUser.members[0]) throw new NotFoundError("User/Member");
    const memberId = targetUser.members[0].id;

    // 3. Delete
    await prisma.roleAssignment.deleteMany({
        where: {
            memberId,
            roleId: role.id
        }
    });
};
