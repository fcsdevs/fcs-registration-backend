import { getPrismaClient } from '../../lib/prisma.js';
import { AppError, NotFoundError } from '../../middleware/error-handler.js';
import { calculateAttendanceRate } from '../../lib/helpers.js';

const prisma = getPrismaClient();

/**
 * Get comprehensive event analytics
 * Returns: registrations by mode, attendance by mode, capacity utilization by center
 */
export const getEventAnalytics = async (eventId, query = {}) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { unit: true },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const { startDate, endDate } = query;
  const dateFilter = {
    createdAt: {},
  };

  if (startDate) dateFilter.createdAt.gte = new Date(startDate);
  if (endDate) dateFilter.createdAt.lte = new Date(endDate);

  // Get participation modes for all registrations of this event
  const participations = await prisma.registrationParticipation.findMany({
    where: {
      registration: {
        eventId,
        ...dateFilter
      }
    },
    select: { participationMode: true }
  });

  const registrationsByModeMap = participations.reduce((acc, p) => {
    acc[p.participationMode] = (acc[p.participationMode] || 0) + 1;
    return acc;
  }, {});

  const registrationsByMode = Object.entries(registrationsByModeMap).map(([mode, count]) => ({
    participationMode: mode,
    _count: { id: count }
  }));

  // Get attendance by participation mode
  const attendanceByMode = await prisma.attendanceRecord.groupBy({
    by: ['participationMode'],
    where: {
      registration: { eventId },
    },
    _count: {
      id: true,
    },
  });

  // Get center statistics
  const centers = await prisma.eventCenter.findMany({
    where: { eventId, isActive: true },
    include: {
      _count: {
        select: { registrations: true, attendances: true },
      },
    },
  });

  const centerStats = centers.map((center) => ({
    centerId: center.id,
    name: center.centerName,
    state: center.state,
    registrations: center._count.registrations,
    attendance: center._count.attendances,
  }));

  // Calculate overall statistics
  const totalRegistrations = registrationsByMode.reduce(
    (sum, r) => sum + r._count.id,
    0
  );
  const totalAttendance = attendanceByMode.reduce(
    (sum, a) => sum + a._count.id,
    0
  );
  const attendanceRate =
    totalRegistrations > 0 ? (totalAttendance / totalRegistrations) * 100 : 0;

  return {
    event: {
      id: event.id,
      name: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      unit: event.unit,
    },
    overview: {
      totalRegistrations,
      totalAttendance,
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
      totalCenters: centers.length,
    },
    registrationsByMode: registrationsByMode.map((r) => ({
      mode: r.participationMode,
      count: r._count.id,
    })),
    attendanceByMode: attendanceByMode.map((a) => ({
      mode: a.participationMode,
      count: a._count.id,
    })),
    centerStats,
  };
};

/**
 * Get center analytics (registrations, attendance, capacity)
 */
export const getCenterAnalytics = async (centerId, query = {}) => {
  const center = await prisma.eventCenter.findUnique({
    where: { id: centerId },
    include: { event: true },
  });

  if (!center) {
    throw new NotFoundError('Center not found');
  }

  const { startDate, endDate } = query;
  const dateFilter = {
    createdAt: {},
  };

  if (startDate) dateFilter.createdAt.gte = new Date(startDate);
  if (endDate) dateFilter.createdAt.lte = new Date(endDate);

  // Get registrations by participation mode
  const registrations = await prisma.registration.findMany({
    where: {
      centerId,
      ...dateFilter,
    },
    include: {
      member: true,
      group: true,
    },
  });

  // Get attendance records
  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      centerId,
    },
    include: {
      registration: { include: { member: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });

  // Group registrations by mode
  const registrationsByMode = {};
  const attendanceByMode = {};

  registrations.forEach((r) => {
    const mode = r.participationMode;
    registrationsByMode[mode] = (registrationsByMode[mode] || 0) + 1;
  });

  attendance.forEach((a) => {
    const mode = a.participationMode;
    attendanceByMode[mode] = (attendanceByMode[mode] || 0) + 1;
  });

  const attendanceRate =
    registrations.length > 0
      ? (attendance.length / registrations.length) * 100
      : 0;

  return {
    center: {
      id: center.id,
      name: center.centerName,
      state: center.state,
      address: center.address,
    },
    event: {
      id: center.event.id,
      name: center.event.title,
    },
    statistics: {
      totalRegistrations: registrations.length,
      totalAttendance: attendance.length,
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
    },
    registrationsByMode: Object.entries(registrationsByMode).map(
      ([mode, count]) => ({ mode, count })
    ),
    attendanceByMode: Object.entries(attendanceByMode).map(([mode, count]) => ({
      mode,
      count,
    })),
    recentAttendance: attendance.slice(0, 20).map((a) => ({
      recordId: a.id,
      member: {
        id: a.registration.member.id,
        name: a.registration.member.name,
        fcsCode: a.registration.member.fcsCode,
      },
      checkInTime: a.checkInTime,
      checkOutTime: a.checkOutTime,
      mode: a.participationMode,
    })),
  };
};

/**
 * Get member attendance report
 */
export const getMemberAttendanceReport = async (memberId, query = {}) => {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new NotFoundError('Member not found');
  }

  const { eventId, startDate, endDate } = query;
  const dateFilter = {};

  if (startDate) dateFilter.createdAt = { gte: new Date(startDate) };
  if (endDate)
    dateFilter.createdAt = {
      ...dateFilter.createdAt,
      lte: new Date(endDate),
    };

  // Get attendance records for member
  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      registration: {
        memberId,
        ...(eventId && { eventId }),
      },
      ...dateFilter,
    },
    include: {
      registration: {
        include: {
          event: true,
          center: true,
        },
      },
    },
    orderBy: { checkInTime: 'desc' },
  });

  // Group by event
  const byEvent = {};
  attendance.forEach((a) => {
    const eventId = a.registration.event.id;
    if (!byEvent[eventId]) {
      byEvent[eventId] = {
        event: a.registration.event,
        records: [],
      };
    }
    byEvent[eventId].records.push(a);
  });

  // Calculate statistics
  const totalAttendance = attendance.length;
  const attendanceByMode = {};

  attendance.forEach((a) => {
    const mode = a.participationMode;
    attendanceByMode[mode] = (attendanceByMode[mode] || 0) + 1;
  });

  return {
    member: {
      id: member.id,
      name: member.name,
      fcsCode: member.fcsCode,
      email: member.email,
      phone: member.phone,
      state: member.state,
    },
    statistics: {
      totalAttendance,
      attendanceByMode: Object.entries(attendanceByMode).map(
        ([mode, count]) => ({ mode, count })
      ),
    },
    eventAttendance: Object.values(byEvent).map((e) => ({
      event: {
        id: e.event.id,
        name: e.event.title,
        startDate: e.event.startDate,
        endDate: e.event.endDate,
      },
      attendance: e.records.map((r) => ({
        recordId: r.id,
        center: r.registration.center?.name || 'Online',
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        mode: r.participationMode,
        duration: r.durationSeconds,
      })),
    })),
  };
};

/**
 * Get state-wise analytics (across all events/centers)
 */
export const getStateAnalytics = async (query = {}) => {
  const { eventId, startDate, endDate } = query;
  const dateFilter = {};

  if (startDate) dateFilter.createdAt = { gte: new Date(startDate) };
  if (endDate)
    dateFilter.createdAt = {
      ...dateFilter.createdAt,
      lte: new Date(endDate),
    };

  // Get member distribution by state
  const membersByState = await prisma.member.groupBy({
    by: ['state'],
    _count: {
      id: true,
    },
  });

  // Get centers by state
  const centersByState = await prisma.eventCenter.groupBy({
    by: ['state'],
    where: {
      ...(eventId && { eventId }),
      isActive: true,
    },
    _count: {
      id: true,
    },
  });

  // Get registrations by state
  const registrationsByState = await prisma.registration.groupBy({
    by: ['member'],
    where: {
      ...(eventId && { eventId }),
      ...dateFilter,
    },
  });

  // Group registration state data
  const regByState = {};
  for (const reg of registrationsByState) {
    // Note: This is a simplified grouping; in real implementation,
    // you'd need to join with member state
    regByState[reg.memberId] = (regByState[reg.memberId] || 0) + 1;
  }

  return {
    memberDistribution: membersByState.map((m) => ({
      state: m.state,
      count: m._count.id,
    })),
    centerDistribution: centersByState.map((c) => ({
      state: c.state,
      count: c._count.id,
    })),
    period: {
      startDate,
      endDate,
    },
  };
};

/**
 * Export event report as structured data
 */
export const exportEventReport = async (eventId, format = 'json') => {
  const analytics = await getEventAnalytics(eventId);

  // Add detailed registration list
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    include: {
      member: true,
      center: true,
      group: true,
    },
  });

  const report = {
    exportDate: new Date().toISOString(),
    event: analytics.event,
    overview: analytics.overview,
    statistics: {
      registrationsByMode: analytics.registrationsByMode,
      attendanceByMode: analytics.attendanceByMode,
      centerStats: analytics.centerStats,
    },
    registrations: registrations.map((r) => ({
      registrationId: r.id,
      member: {
        id: r.member.id,
        name: r.member.name,
        fcsCode: r.member.fcsCode,
      },
      participationMode: r.participationMode,
      center: r.center?.centerName || 'N/A',
      group: r.group?.name || 'Unassigned',
      status: r.status,
      registeredAt: r.createdAt,
    })),
  };

  if (format === 'csv') {
    return convertReportToCSV(report);
  }

  return report;
};

/**
 * Convert report to CSV format
 */
const convertReportToCSV = (report) => {
  const headers = [
    'Registration ID',
    'Member Name',
    'FCS Code',
    'Participation Mode',
    'Center',
    'Group',
    'Status',
    'Registered At',
  ];

  const rows = report.registrations.map((r) => [
    r.registrationId,
    r.member.name,
    r.member.fcsCode,
    r.participationMode,
    r.center,
    r.group,
    r.status,
    r.registeredAt,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  return csv;
};

/**
 * Get dashboard summary (key metrics)
 */
export const getDashboardSummary = async (query = {}) => {
  const { eventId, centerId } = query;

  // Time boundaries for trends
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Scoping logic
  const memberWhere = { isActive: true };
  let eventWhere = { isPublished: true };
  let isNational = false;

  if (query.unitId) {
    const scopeUnit = await prisma.unit.findUnique({
      where: { id: query.unitId },
      include: { unitType: true }
    });
    if (scopeUnit && scopeUnit.unitType) {
      const typeName = scopeUnit.unitType.name.toLowerCase();
      if (typeName.includes('national')) {
        isNational = true;
      } else {
        if (typeName.includes('state')) memberWhere.state = { contains: scopeUnit.name, mode: 'insensitive' };
        else if (typeName.includes('zone')) memberWhere.zone = { contains: scopeUnit.name, mode: 'insensitive' };
        else if (typeName.includes('branch')) memberWhere.branch = { contains: scopeUnit.name, mode: 'insensitive' };
        eventWhere.unitId = query.unitId;
      }
    }
  }

  // 1. Core Metrics & Trends
  const [
    totalMembers,
    lastMonthMembers,
    activeEventsCount,
    lastMonthEventsCount,
    thisMonthRegistrations,
    lastMonthRegistrations
  ] = await Promise.all([
    prisma.member.count({ where: memberWhere }),
    prisma.member.count({ where: { ...memberWhere, createdAt: { lt: thisMonthStart } } }),
    prisma.event.count({ where: eventWhere }),
    prisma.event.count({ where: { ...eventWhere, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.registration.count({
      where: {
        createdAt: { gte: thisMonthStart },
        ...(query.unitId && !isNational && { event: { unitId: query.unitId } })
      }
    }),
    prisma.registration.count({
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        ...(query.unitId && !isNational && { event: { unitId: query.unitId } })
      }
    }),
  ]);

  // Calculations for Trends
  const memberGrowth = lastMonthMembers > 0 ? ((totalMembers - lastMonthMembers) / lastMonthMembers) * 100 : 0;
  const eventGrowth = lastMonthEventsCount > 0 ? ((activeEventsCount - lastMonthEventsCount) / lastMonthEventsCount) * 100 : 0;
  const registrationGrowth = lastMonthRegistrations > 0 ? ((thisMonthRegistrations - lastMonthRegistrations) / lastMonthRegistrations) * 100 : 0;

  // Check-ins today
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const checkedInToday = await prisma.attendanceRecord.count({
    where: {
      checkInTime: { gte: todayStart },
      ...(query.unitId && !isNational && { event: { unitId: query.unitId } })
    }
  });

  // 2. Recent/Active Event Summary (Intelligent Selection)
  // Logic: Find an event that is currently happening, or the most recently finished one
  const recentEvent = await prisma.event.findFirst({
    where: eventWhere,
    orderBy: [
      { startDate: 'desc' }
    ],
    include: {
      _count: { select: { registrations: true, attendances: true } },
      centers: {
        include: {
          _count: { select: { registrations: true, attendances: true } }
        }
      }
    }
  });

  let checkInMethods = { qr: 0, sac: 0, manual: 0 };
  if (recentEvent) {
    const records = await prisma.attendanceRecord.groupBy({
      by: ['checkInMethod'],
      where: { eventId: recentEvent.id },
      _count: { id: true }
    });
    records.forEach(r => {
      const method = r.checkInMethod?.toUpperCase();
      if (method === 'QR' || method === 'SCAN') checkInMethods.qr += r._count.id;
      else if (method === 'SAC' || method === 'CODE') checkInMethods.sac += r._count.id;
      else checkInMethods.manual += r._count.id;
    });
  }

  return {
    overview: {
      totalMembers,
      memberGrowth: parseFloat(memberGrowth.toFixed(1)),
      activeEvents: activeEventsCount,
      eventGrowth: parseFloat(eventGrowth.toFixed(1)),
      thisMonthRegistrations,
      registrationGrowth: parseFloat(registrationGrowth.toFixed(1)),
      checkedInToday,
    },
    recentSession: recentEvent ? {
      id: recentEvent.id,
      title: recentEvent.title,
      totalRegistered: recentEvent._count.registrations,
      totalAttended: recentEvent._count.attendances,
      attendanceRate: recentEvent._count.registrations > 0
        ? Math.round((recentEvent._count.attendances / recentEvent._count.registrations) * 100)
        : 0,
      centers: recentEvent.centers.map(c => ({
        name: c.centerName,
        attended: c._count.attendances,
        registered: c._count.registrations
      })),
      checkInMethods
    } : null,
  };
};
