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
import { getAdminScope } from '../../middleware/scope-validator.js';
import { createMemberSchema, updateMemberSchema, paginationSchema } from '../../lib/validation.js';
import getPrismaClient from '../../lib/prisma.js';
const prisma = getPrismaClient();
import { cloudinaryUploadImage } from '../../lib/cloudinary.js';
import fs from 'fs';

/**
 * Handle image upload for member profile
 * Non-blocking: fails gracefully without blocking profile update
 */
const handleProfileImageUpload = async (req) => {
  if (req.file) {
    try {
      console.log('--- UPLOADING PROFILE IMAGE ---');
      console.log('File path:', req.file.path);
      console.log('Cloudinary Config Check:');
      console.log('- Cloud Name present:', !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME));
      console.log('- API Key present:', !!(process.env.CLOUDINARY_API_KEY || process.env.API_KEY));
      console.log('- API Secret present:', !!(process.env.CLOUDINARY_API_SECRET || process.env.SECRET_KEY));

      // Add timeout to prevent hanging uploads
      const uploadWithTimeout = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image upload timeout (exceeded 10 seconds)'));
        }, 10000);

        cloudinaryUploadImage(req.file.path)
          .then(result => {
            clearTimeout(timeout);
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
      });

      const uploadResult = await uploadWithTimeout;
      req.body.profilePhotoUrl = uploadResult.url;
      console.log('✅ Profile image uploaded successfully');
    } catch (uploadError) {
      console.warn('⚠️ Profile image upload failed (non-blocking):', uploadError.message);
      // Log the error but don't throw - allow profile update to proceed without image
      console.log('Continuing with profile update without image...');
    } finally {
      // Clean up resized file from local storage
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('✅ Cleaned up local image file');
        } catch (err) {
          console.warn('⚠️ Failed to clean up local file:', err.message);
        }
      }
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

    // Enforce Scope with new scope-validator
    const scope = await getAdminScope(req.userId);
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
      adminScope: scope,
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
