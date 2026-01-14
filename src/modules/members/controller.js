import {
  createMember,
  getMemberById,
  getMemberByFCSCode,
  listMembers,
  updateMember,
  addGuardian,
  removeGuardian,
  getMemberAttendanceSummary,
  deactivateMember,
  searchMembers,
  getMemberByAuthId,
} from './service.js';
import { getEffectiveScope } from '../users/service.js';
import { createMemberSchema, updateMemberSchema, paginationSchema } from '../../lib/validation.js';
import prisma from '../../lib/prisma.js';
import { cloudinaryUploadImage } from '../../lib/cloudinary.js';
import fs from 'fs';

/**
 * Handle image upload for member profile
 */
const handleProfileImageUpload = async (req) => {
  if (req.file) {
    try {
      const uploadResult = await cloudinaryUploadImage(req.file.path);
      req.body.profilePhotoUrl = uploadResult.url;

      // Clean up resized file from local storage
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (uploadError) {
      console.error('Profile image upload failed:', uploadError);
      // We continue even if image fails
    }
  }
};

/**
 * POST /api/members
 */
export const createMemberHandler = async (req, res, next) => {
  try {
    await handleProfileImageUpload(req);
    const { error, value } = createMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const member = await createMember(value, req.userId);
    res.status(201).json({
      data: member,
      message: 'Member created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/members
 */
export const listMembersHandler = async (req, res, next) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    // Enforce Scope
    const scope = await getEffectiveScope(req.userId);
    let effectiveUnitId = req.query.unitId;

    if (!scope.isGlobal) {
      effectiveUnitId = scope.unitId;
    }

    const members = await listMembers({
      ...value,
      search: req.query.search,
      state: req.query.state,
      isActive: req.query.isActive,
      gender: req.query.gender,
      unitId: effectiveUnitId,
    });

    res.status(200).json(members);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/members/:id
 */
export const getMemberHandler = async (req, res, next) => {
  try {
    const member = await getMemberById(req.params.id);
    res.status(200).json({
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/members/code/:code
 */
export const getMemberByCodeHandler = async (req, res, next) => {
  try {
    const member = await getMemberByFCSCode(req.params.code);
    res.status(200).json({
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/members/:id
 */
export const updateMemberHandler = async (req, res, next) => {
  try {
    await handleProfileImageUpload(req);
    const { error, value } = updateMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    const member = await updateMember(req.params.id, value);
    res.status(200).json({
      data: member,
      message: 'Member updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/members/profile
 */
export const updateProfileHandler = async (req, res, next) => {
  try {
    await handleProfileImageUpload(req);
    const { error, value } = updateMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
    }

    // Get member for current user
    const member = await getMemberByAuthId(req.userId);

    // Update member
    const updatedMember = await updateMember(member.id, value);

    res.status(200).json({
      data: updatedMember,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/members/:id/attendance-summary
 */
export const getAttendanceSummaryHandler = async (req, res, next) => {
  try {
    const summary = await getMemberAttendanceSummary(req.params.id);
    res.status(200).json({
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/members/:id/guardians
 */
export const addGuardianHandler = async (req, res, next) => {
  try {
    const { guardianId, relationship } = req.body;

    if (!guardianId || !relationship) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'guardianId and relationship are required',
        },
      });
    }

    const guardian = await addGuardian(req.params.id, guardianId, relationship);
    res.status(201).json({
      data: guardian,
      message: 'Guardian added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/members/:id/guardians/:guardianId
 */
export const removeGuardianHandler = async (req, res, next) => {
  try {
    const result = await removeGuardian(req.params.id, req.params.guardianId);
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/members/:id
 */
export const deactivateMemberHandler = async (req, res, next) => {
  try {
    const member = await deactivateMember(req.params.id);
    res.status(200).json({
      data: member,
      message: 'Member deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/members/search
 * Supports two modes:
 * 1. General search: ?q=query (searches name and FCS code)
 * 2. Extensive search: ?lastName=X&email=Y&phoneNumber=Z (requires at least 2 params)
 */
export const searchMembersHandler = async (req, res, next) => {
  try {
    const { q, lastName, email, phoneNumber } = req.query;

    // Mode 1: General search with 'q' parameter
    if (q) {
      if (q.length < 2) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query must be at least 2 characters',
          },
        });
      }

      const members = await searchMembers(q);
      return res.status(200).json({
        data: members,
      });
    }

    // Mode 2: Extensive search with specific fields
    const searchFields = { lastName, email, phoneNumber };
    const filledFields = Object.values(searchFields).filter(val => val && val.trim() !== '');

    if (filledFields.length < 2) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide at least 2 search criteria (lastName, email, or phoneNumber)',
        },
      });
    }

    // Build search conditions
    const whereConditions = {
      isActive: true,
      AND: [],
    };

    if (lastName && lastName.trim()) {
      whereConditions.AND.push({
        lastName: { contains: lastName.trim(), mode: 'insensitive' }
      });
    }

    if (email && email.trim()) {
      whereConditions.AND.push({
        email: { contains: email.trim(), mode: 'insensitive' }
      });
    }

    if (phoneNumber && phoneNumber.trim()) {
      whereConditions.AND.push({
        phoneNumber: { contains: phoneNumber.trim() }
      });
    }

    const members = await prisma.member.findMany({
      where: whereConditions,
      select: {
        id: true,
        fcsCode: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        gender: true,
        dateOfBirth: true,
      },
      take: 20,
    });

    res.status(200).json({
      data: members,
    });
  } catch (error) {
    next(error);
  }
};
