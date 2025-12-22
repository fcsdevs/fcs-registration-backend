import { createInvite, verifyInvite, acceptInvite } from './service.js';

export const createInviteHandler = async (req, res, next) => {
    try {
        const invite = await createInvite(req.body, req.userId);
        res.status(201).json({ data: invite, message: "Invitation sent" });
    } catch (e) { next(e); }
};

export const verifyInviteHandler = async (req, res, next) => {
    try {
        const { id, token } = req.query;
        const result = await verifyInvite(id, token);
        res.status(200).json({ data: result });
    } catch (e) { next(e); }
};

export const acceptInviteHandler = async (req, res, next) => {
    try {
        const { id, token } = req.body;
        // In a real flow, user might need to login/signup here if not already
        // Assuming user acts anonymously or we merge this with auth flow
        // For now, let's assume they accept and we return success
        await acceptInvite(id, token);
        res.status(200).json({ message: "Invitation accepted" });
    } catch (e) { next(e); }
};
