import { getPrismaClient } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../middleware/error-handler.js';
import { randomBytes } from 'crypto';

const prisma = getPrismaClient();

export const createInvite = async (data, invitedBy) => {
    const { email, role, unitId } = data;

    // Find Role
    const roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) throw new NotFoundError("Role");

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return prisma.invite.create({
        data: {
            email,
            roleId: roleRecord.id,
            unitId,
            invitedBy,
            token,
            expiresAt
        }
    });
};

export const verifyInvite = async (id, token) => {
    const invite = await prisma.invite.findUnique({
        where: { id },
        include: { unit: true, role: true, invitedByUser: { include: { members: true } } }
    });

    if (!invite || invite.token !== token) throw new ValidationError("Invalid invitation");
    if (invite.status !== 'PENDING') throw new ValidationError("Invitation already used or expired");
    if (new Date() > invite.expiresAt) throw new ValidationError("Invitation expired");

    return {
        role: invite.role.name,
        unitName: invite.unit?.name || 'Organization',
        inviterName: invite.invitedByUser.members[0]?.firstName || 'Admin'
    };
};

export const acceptInvite = async (id, token) => {
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite || invite.token !== token) throw new ValidationError("Invalid");

    // Update status
    await prisma.invite.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() }
    });

    // TODO: Actually link to a user. This part typically requires the user to currently be logged in
    // or part of a registration flow. 
    // For this pass, we just mark as accepted.
};
