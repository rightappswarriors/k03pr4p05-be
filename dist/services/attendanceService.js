import { prisma } from '../lib/prisma.js';
// ─── Helpers ────────────────────────────────────────────────────────────────
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
// ─── Service ─────────────────────────────────────────────────────────────────
export class AttendanceService {
    // ── Private: resolve userId's orgId and active shift ─────────────────────
    async resolveUserShift(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const userShift = await prisma.userShift.findFirst({
            where: {
                userId,
                shift: { orgId: user.orgId }
            },
            include: { shift: true }
        });
        if (!userShift)
            throw new Error('No shift assigned to this user');
        return { user, userShift };
    }
    // ── Private: get today's attendance record (throws if missing) ────────────
    async getTodayRecord(userId) {
        const record = await prisma.attendance.findFirst({
            where: { userId, shiftDate: startOfToday() }
        });
        return record;
    }
    // ── TIME IN ───────────────────────────────────────────────────────────────
    async timeIn(userId, photoIn, noteIn) {
        const { user, userShift } = await this.resolveUserShift(userId);
        const today = startOfToday();
        const existing = await prisma.attendance.findUnique({
            where: { userId_shiftDate: { userId, shiftDate: today } }
        });
        if (existing?.timeIn) {
            throw new Error('Already timed in today');
        }
        const data = {
            timeIn: new Date(),
            photoIn,
            noteIn,
            status: 'PRESENT'
        };
        if (existing) {
            return prisma.attendance.update({
                where: { id: existing.id },
                data,
                include: { user: true, shift: true }
            });
        }
        return prisma.attendance.create({
            data: {
                userId,
                shiftId: userShift.shiftId,
                shiftDate: today,
                orgId: user.orgId,
                ...data
            },
            include: { user: true, shift: true }
        });
    }
    // ── START BREAK ───────────────────────────────────────────────────────────
    async startBreak(userId, photoBreakStart, noteBreakStart) {
        const record = await this.getTodayRecord(userId);
        if (!record?.timeIn) {
            throw new Error('Must be timed in before starting a break');
        }
        if (record.breakStart) {
            throw new Error('Break already started today');
        }
        if (record.timeOut) {
            throw new Error('Already timed out — cannot start a break');
        }
        return prisma.attendance.update({
            where: { id: record.id },
            data: {
                breakStart: new Date(),
                photoBreakStart,
                noteBreakStart,
                status: 'ON_BREAK'
            },
            include: { user: true, shift: true }
        });
    }
    // ── END BREAK ─────────────────────────────────────────────────────────────
    async endBreak(userId, photoBreakEnd, noteBreakEnd) {
        const record = await this.getTodayRecord(userId);
        if (!record?.breakStart) {
            throw new Error('No active break to end');
        }
        if (record.breakEnd) {
            throw new Error('Break already ended');
        }
        if (record.status !== 'ON_BREAK') {
            throw new Error('User is not currently on break');
        }
        return prisma.attendance.update({
            where: { id: record.id },
            data: {
                breakEnd: new Date(),
                photoBreakEnd,
                noteBreakEnd,
                status: 'PRESENT'
            },
            include: { user: true, shift: true }
        });
    }
    // ── TIME OUT ──────────────────────────────────────────────────────────────
    async timeOut(userId, photoOut, noteOut) {
        const record = await this.getTodayRecord(userId);
        if (!record?.timeIn) {
            throw new Error('Must be timed in before timing out');
        }
        if (record.timeOut) {
            throw new Error('Already timed out today');
        }
        return prisma.attendance.update({
            where: { id: record.id },
            data: {
                timeOut: new Date(),
                photoOut,
                noteOut,
                status: 'OFF_DUTY'
            },
            include: { user: true, shift: true }
        });
    }
    // ── MY ATTENDANCE TODAY ───────────────────────────────────────────────────
    async getMyAttendanceToday(userId) {
        return prisma.attendance.findFirst({
            where: { userId, shiftDate: startOfToday() },
            include: { shift: true, user: true }
        });
    }
    // ── MY ATTENDANCE HISTORY (paginated) ─────────────────────────────────────
    async getMyAttendanceHistory(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            prisma.attendance.findMany({
                where: { userId },
                orderBy: { shiftDate: 'desc' },
                skip,
                take: limit,
                include: { shift: true }
            }),
            prisma.attendance.count({ where: { userId } })
        ]);
        return {
            items,
            total,
            page,
            limit,
            hasMore: skip + items.length < total
        };
    }
    // ── MY PERFORMANCE SUMMARY ────────────────────────────────────────────────
    async getMyPerformanceSummary(userId, from, to, lateThresholdMinutes = 540 // 9:00 AM = 540 min from midnight
    ) {
        return this._computePerformance(userId, from, to, lateThresholdMinutes);
    }
    // ── OWNER: TODAY'S ATTENDANCE LIST (paginated, filterable by role) ────────
    async getTodayAttendanceByOrg(orgId, page = 1, limit = 20, role // optional: 'STAFF' | 'CASHIER'
    ) {
        const skip = (page - 1) * limit;
        const today = startOfToday();
        // Fetch users in org (filtered by role if given)
        const userWhere = { orgId };
        if (role)
            userWhere.role = role;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where: userWhere,
                skip,
                take: limit,
                orderBy: { fullname: 'asc' },
                select: {
                    id: true,
                    fullname: true,
                    role: true,
                    email: true,
                    attendances: {
                        where: { shiftDate: today },
                        take: 1,
                        include: { shift: true }
                    }
                }
            }),
            prisma.user.count({ where: userWhere })
        ]);
        const items = users.map(u => {
            const attendance = u.attendances[0] ?? null;
            return {
                user: { id: u.id, name: u.fullname, role: u.role, email: u.email },
                attendance,
                status: attendance?.status ?? 'ABSENT'
            };
        });
        return {
            items,
            total,
            page,
            limit,
            hasMore: skip + items.length < total
        };
    }
    // ── OWNER: A USER'S ATTENDANCE HISTORY (paginated) ────────────────────────
    async getUserAttendanceHistory(orgId, targetUserId, page = 1, limit = 20) {
        // Verify the target user belongs to the same org
        const targetUser = await prisma.user.findFirst({
            where: { id: targetUserId, orgId }
        });
        if (!targetUser)
            throw new Error('User not found in your organization');
        return this.getMyAttendanceHistory(targetUserId, page, limit);
    }
    // ── OWNER: A USER'S PERFORMANCE SUMMARY ──────────────────────────────────
    async getUserPerformanceSummary(orgId, targetUserId, from, to, lateThresholdMinutes = 540) {
        const targetUser = await prisma.user.findFirst({
            where: { id: targetUserId, orgId }
        });
        if (!targetUser)
            throw new Error('User not found in your organization');
        return this._computePerformance(targetUserId, from, to, lateThresholdMinutes);
    }
    // ── PRIVATE: compute performance from attendance records ──────────────────
    async _computePerformance(userId, from, to, lateThresholdMinutes) {
        const records = await prisma.attendance.findMany({
            where: {
                userId,
                shiftDate: { gte: startOfDay(from), lte: startOfDay(to) }
            }
        });
        const totalWorkdays = records.length;
        const presentDays = records.filter(r => ['PRESENT', 'ON_BREAK', 'OFF_DUTY'].includes(r.status)).length;
        const absentDays = records.filter(r => r.status === 'ABSENT').length;
        // Half day: timed in but no time out (and not still on shift)
        const halfDays = records.filter(r => r.timeIn && !r.timeOut && r.status !== 'ON_BREAK').length;
        const loginTimes = records
            .filter(r => r.timeIn !== null)
            .map(r => {
            const t = r.timeIn;
            return t.getHours() * 60 + t.getMinutes(); // minutes from midnight
        });
        const lateLogins = loginTimes.filter(t => t > lateThresholdMinutes).length;
        const avgLoginTimeMinutes = loginTimes.length > 0
            ? Math.round(loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length)
            : null;
        const attendanceRate = totalWorkdays > 0
            ? parseFloat((presentDays / totalWorkdays).toFixed(4))
            : 0;
        return {
            userId,
            totalWorkdays,
            presentDays,
            absentDays,
            halfDays,
            lateLogins,
            attendanceRate,
            avgLoginTimeMinutes
        };
    }
}
