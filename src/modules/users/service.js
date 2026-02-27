import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middleware/error-handler.js';
import { getAllDescendantIds } from '../units/service.js';
import { getAdminScope, canManageUser, isWithinScope } from '../../middleware/scope-validator.js';

const prisma = getPrismaClient();

/**
 * DEPRECATED: Use getAdminScope from scope-validator.js instead
 * Kept for backward compatibility
 */
export const getEffectiveScope = async (userId) => getAdminScope(userId);


export const checkScopeAccess = async (userId, targetUnitId) => {
    if (!targetUnitId) return true;
    const scope = await getEffectiveScope(userId);
    if (scope.isGlobal) return true;
    if (!scope.unitId) return false;

    if (scope.unitId === targetUnitId) return true;

    const descendants = await getAllDescendantIds(scope.unitId);
    return descendants.includes(targetUnitId);
};

export const listUsers = async ({ role, unitId, search }) => {

    // Define criteria for the Role Assignment itself
    const roleAssignmentWhere = {};

    if (role) {
        if (role.toLowerCase() === 'admin') {
            roleAssignmentWhere.role = { name: { contains: 'admin', mode: 'insensitive' } };
        } else {
            roleAssignmentWhere.role = { name: { equals: role, mode: 'insensitive' } };
        }
    }

    if (unitId) {
        // Check if unit is National (Global Scope)
        const scopeUnit = await prisma.unit.findUnique({
            where: { id: unitId },
            include: { unitType: true }
        });

        const isNational = scopeUnit?.unitType?.name?.includes('National') || scopeUnit?.name?.includes('National');

        if (!isNational) {
            const unitIds = [unitId, ...(await getAllDescendantIds(unitId))];
            roleAssignmentWhere.unitId = { in: unitIds };
        }
        // If National, we do NOT restrict unitId, allowing all assignments.
    }

    // Main Query Construction
    // matching users who have MEMBERS who have ROLE ASSIGNMENTS matching criteria.
    const where = {};

    // Apply role/unit filter if relevant
    if (unitId || role) {
        where.members = {
            some: {
                roleAssignments: {
                    some: roleAssignmentWhere
                }
            }
        };
    }

    // Search Logic
    if (search) {
        const searchParts = search.trim().split(/\s+/);
        const searchConditions = [
            { email: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } },
            ...searchParts.map(part => ({
                members: { some: { firstName: { contains: part, mode: 'insensitive' } } }
            })),
            ...searchParts.map(part => ({
                members: { some: { lastName: { contains: part, mode: 'insensitive' } } }
            })),
            { members: { some: { fcsCode: { contains: search, mode: 'insensitive' } } } },
        ];

        // Combine with existing filters using AND logic if needed
        if (Object.keys(where).length > 0) {
            where.AND = [
                { OR: searchConditions }
            ];
        } else {
            where.OR = searchConditions;
        }
    }

    const users = await prisma.authUser.findMany({
        where,
        include: {
            members: {
                include: {
                    roleAssignments: {
                        include: {
                            role: true,
                            unit: { include: { unitType: true } }
                        }
                    }
                }
            }
        }
    });



    // Map to frontend friendly format
    return users.map(u => {
        const member = u.members[0]; // Assuming 1-to-1 or Primary
        // Flatten assignments from all members to find roles
        const allAssignments = u.members.flatMap(m => m.roleAssignments);

        return {
            id: u.id,
            firstName: member?.firstName || '',
            lastName: member?.lastName || '',
            email: u.email,
            roles: allAssignments.map(ra => ra?.role?.name).filter(Boolean),
            level: allAssignments[0]?.unit?.unitType?.name || 'Unknown',
            unitId: allAssignments[0]?.unitId,
            memberCode: member?.fcsCode || '',
        };
    });
};

export const assignUserRole = async (targetUserId, roleName, unitId, assignedByUserId, shouldReplace = false) => {
    console.log('🔍 [SERVICE] assignUserRole called:', { targetUserId, roleName, unitId, assignedByUserId, shouldReplace });

    // 1. Get Role ID
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    console.log('🔍 [SERVICE] Role lookup result:', role);
    if (!role) {
        console.error('[SERVICE] Role not found:', roleName);
        throw new NotFoundError(`Role ${roleName}`);
    }

    // 2. Verify scope access (HRBAC: Can assignedByUserId assign to this unit?)
    if (unitId) {
        // Check if admin is within scope of the target unit
        // (allows assigning to users who don't yet have a role)
        const adminScope = await getAdminScope(assignedByUserId);
        if (!adminScope.isGlobal) {
            const hasAccess = await isWithinScope(assignedByUserId, unitId);
            if (!hasAccess) {
                console.error('[SERVICE] HRBAC violation. Admin cannot assign role to this unit.');
                throw new ForbiddenError('You do not have permission to assign roles to this unit');
            }
        }
    }

    // 3. Find User's Member Profile
    const targetUser = await prisma.authUser.findUnique({
        where: { id: targetUserId },
        include: { members: true }
    });

    if (!targetUser || !targetUser.members[0]) {
        console.error('❌ [SERVICE] User/Member not found:', targetUserId);
        throw new NotFoundError("User/Member");
    }
    const memberId = targetUser.members[0].id;

    // Transaction to safely handle replace
    return await prisma.$transaction(async (tx) => {
        if (shouldReplace) {
            console.log('⚠️ [SERVICE] Replacing existing roles for member:', memberId);
            // Delete all existing role assignments for this member
            // You might want to filter this if you have non-administrative roles to preserve
            await tx.roleAssignment.deleteMany({
                where: { memberId }
            });
        }

        // 4. Create/Update Assignment with HRBAC tracking
        const existing = await tx.roleAssignment.findFirst({
            where: { memberId, roleId: role.id, unitId }
        });

        if (existing) {
            console.log('✅ [SERVICE] Assignment already exists, returning existing');
            return existing;
        }

        console.log('🔍 [SERVICE] Creating new role assignment...');
        const newAssignment = await tx.roleAssignment.create({
            data: {
                memberId,
                roleId: role.id,
                unitId,
                assignedBy: assignedByUserId
            }
        });
        console.log('✅ [SERVICE] Role assignment created:', newAssignment);
        return newAssignment;
    });
};

export const revokeUserRole = async (targetUserId, roleName, requestUserId) => {
    // 1. Get Member ID
    const targetUser = await prisma.authUser.findUnique({
        where: { id: targetUserId },
        include: { members: true }
    });
    if (!targetUser || !targetUser.members[0]) throw new NotFoundError("User/Member");
    const memberId = targetUser.members[0].id;

    // 2. Handle Generic 'admin' revocation (Revoke All)
    if (roleName === 'admin') {
        await prisma.roleAssignment.deleteMany({
            where: { memberId }
        });
        return;
    }

    // 3. Specific Role Revocation
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError(`Role ${roleName}`);

    await prisma.roleAssignment.deleteMany({
        where: {
            memberId,
            roleId: role.id
        }
    });
};

export const getUserById = async (userId) => {
    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        include: {
            members: {
                include: {
                    roleAssignments: {
                        include: {
                            role: true,
                            unit: { include: { unitType: true } }
                        }
                    }
                }
            }
        }
    });

    if (!user) return null;

    const member = user.members[0];
    const allAssignments = user.members.flatMap(m => m.roleAssignments);

    return {
        id: user.id,
        firstName: member?.firstName || '',
        lastName: member?.lastName || '',
        email: user.email,
        phoneNumber: member?.phoneNumber || '',
        roles: allAssignments.map(ra => ra?.role?.name).filter(Boolean),
        assignments: allAssignments.map(ra => ({
            id: ra.id,
            role: ra.role.name,
            unitId: ra.unitId,
            unitName: ra.unit?.name,
            level: ra.unit?.unitType?.name
        })),
        level: allAssignments[0]?.unit?.unitType?.name || 'Unknown',
        unitId: allAssignments[0]?.unitId,
        memberCode: member?.fcsCode || '',
    };
};

export const updateUserProfile = async (targetUserId, data) => {
    const { firstName, lastName, phoneNumber, email, isActive, profiles } = data;

    // 1. Get User and Member
    const user = await prisma.authUser.findUnique({
        where: { id: targetUserId },
        include: { members: true }
    });

    if (!user) throw new NotFoundError("User");
    const member = user.members[0];
    if (!member) throw new NotFoundError("Member profile");

    // 2. Update AuthUser if email or isActive provided
    if (email !== undefined || isActive !== undefined) {
        await prisma.authUser.update({
            where: { id: user.id },
            data: {
                ...(email && { email }),
                ...(isActive !== undefined && { isActive })
            }
        });
    }

    // 3. Update Member
    return await prisma.member.update({
        where: { id: member.id },
        data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phoneNumber && { phoneNumber }),
            // Allow updating other fields if provided in 'profiles'
            ...(profiles || {})
        }
    });
};
