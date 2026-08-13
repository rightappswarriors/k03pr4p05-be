import { extendType, intArg, stringArg, nonNull } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { AttendanceService } from '../../../services/attendanceService.js';
const attendanceService = new AttendanceService();
export const attendanceQuery = extendType({
    type: 'Query',
    definition(t) {
        // ── MY ATTENDANCE TODAY ────────────────────────────────────────────────
        // Roles: STAFF, CASHIER (OWNER can also call this)
        t.field('myAttendanceToday', {
            type: 'Attendance',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                return attendanceService.getMyAttendanceToday(ctx.user.userId);
            }
        });
        // ── MY ATTENDANCE HISTORY ──────────────────────────────────────────────
        // Roles: STAFF, CASHIER (OWNER can also call this for themselves)
        t.field('myAttendanceHistory', {
            type: 'PaginatedAttendance',
            args: {
                page: intArg({ default: 1 }),
                limit: intArg({ default: 20 })
            },
            resolve: async (_, { page, limit }, ctx) => {
                requireAuth(ctx);
                return attendanceService.getMyAttendanceHistory(ctx.user.userId, page ?? 1, limit ?? 20);
            }
        });
        // ── MY PERFORMANCE SUMMARY ─────────────────────────────────────────────
        // Roles: STAFF, CASHIER (OWNER can also call this for themselves)
        t.field('myPerformanceSummary', {
            type: 'PerformanceSummary',
            args: {
                from: nonNull(stringArg()), // ISO date string e.g. "2025-01-01"
                to: nonNull(stringArg()) // ISO date string e.g. "2025-04-10"
            },
            resolve: async (_, { from, to }, ctx) => {
                requireAuth(ctx);
                return attendanceService.getMyPerformanceSummary(ctx.user.userId, new Date(from), new Date(to));
            }
        });
        // ── OWNER: TODAY'S ATTENDANCE LIST ─────────────────────────────────────
        // Role: OWNER only
        // Returns paginated list of ALL users with their today status
        // Optional role filter: 'STAFF' | 'CASHIER'
        t.field('todayAttendanceByOrg', {
            type: 'PaginatedUserAttendance',
            args: {
                page: intArg({ default: 1 }),
                limit: intArg({ default: 20 }),
                role: stringArg() // optional: filter by 'STAFF' | 'CASHIER'
            },
            resolve: async (_, { page, limit, role }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                return attendanceService.getTodayAttendanceByOrg(ctx.user.orgId, page ?? 1, limit ?? 20, role ?? undefined);
            }
        });
        // ── OWNER: A USER'S ATTENDANCE HISTORY ────────────────────────────────
        // Role: OWNER only
        // orgId is pulled from ctx — no way to query outside own org
        t.field('userAttendanceHistory', {
            type: 'PaginatedAttendance',
            args: {
                userId: nonNull(intArg()),
                page: intArg({ default: 1 }),
                limit: intArg({ default: 20 })
            },
            resolve: async (_, { userId, page, limit }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                return attendanceService.getUserAttendanceHistory(ctx.user.orgId, userId, page ?? 1, limit ?? 20);
            }
        });
        // ── OWNER: A USER'S PERFORMANCE SUMMARY ───────────────────────────────
        // Role: OWNER only
        t.field('userPerformanceSummary', {
            type: 'PerformanceSummary',
            args: {
                userId: nonNull(intArg()),
                from: nonNull(stringArg()),
                to: nonNull(stringArg())
            },
            resolve: async (_, { userId, from, to }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                return attendanceService.getUserPerformanceSummary(ctx.user.orgId, userId, new Date(from), new Date(to));
            }
        });
    }
});
