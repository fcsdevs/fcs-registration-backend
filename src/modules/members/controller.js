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
} from './service.js';
import { createMemberSchema, updateMemberSchema, paginationSchema } from '../../lib/validation.js';

/**
 * POST /api/members
 */
export const createMemberHandler = async (req, res, next) => {
  try {
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

    const members = await listMembers({
      ...value,
      search: req.query.search,
      state: req.query.state,
      isActive: req.query.isActive,
    });

    res.status(200).json({
      data: members,
    });
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
 * GET /api/members/search?q=query
 */
export const searchMembersHandler = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query must be at least 2 characters',
        },
      });
    }

    const members = await searchMembers(q);
    res.status(200).json({
      data: members,
    });
  } catch (error) {
    next(error);
  }
};
