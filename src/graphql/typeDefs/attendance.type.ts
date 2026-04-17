import { objectType, enumType } from 'nexus'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const AttendanceStatus = enumType({
    name: 'AttendanceStatus',
    members: ['PRESENT', 'ON_BREAK', 'OFF_DUTY', 'ABSENT']
})

// ─── Attendance ───────────────────────────────────────────────────────────────

export const Attendance = objectType({
    name: 'Attendance',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.int('userId')
        t.nonNull.int('shiftId')
        t.nonNull.string('shiftDate')
        t.field('status', { type: 'AttendanceStatus' })

        // Time In
        t.string('timeIn')
        t.string('photoIn')
        t.string('noteIn')

        // Break Start
        t.string('breakStart')
        t.string('photoBreakStart')
        t.string('noteBreakStart')

        // Break End
        t.string('breakEnd')
        t.string('photoBreakEnd')
        t.string('noteBreakEnd')

        // Time Out
        t.string('timeOut')
        t.string('photoOut')
        t.string('noteOut')

        // Relations
        t.field('user', { type: 'User' })
        t.field('shift', { type: 'Shift' })
    }
})

// ─── Performance Summary ──────────────────────────────────────────────────────

export const PerformanceSummary = objectType({
    name: 'PerformanceSummary',
    definition(t) {
        t.nonNull.int('userId')
        t.nonNull.int('totalWorkdays')
        t.nonNull.int('presentDays')
        t.nonNull.int('absentDays')
        t.nonNull.int('halfDays')
        t.nonNull.int('lateLogins')
        t.nonNull.float('attendanceRate')       // 0.0–1.0
        t.int('avgLoginTimeMinutes')            // nullable — null if no logins yet
    }
})

// ─── Paginated Attendance ─────────────────────────────────────────────────────

export const PaginatedAttendance = objectType({
    name: 'PaginatedAttendance',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'Attendance' })
        t.nonNull.int('total')
        t.nonNull.int('page')
        t.nonNull.int('limit')
        t.nonNull.boolean('hasMore')
    }
})

// ─── User Attendance Entry (for owner list) ───────────────────────────────────
// Wraps a user + their attendance record (or null if absent) + resolved status

export const UserAttendanceEntry = objectType({
    name: 'UserAttendanceEntry',
    definition(t) {
        t.nonNull.field('user', { type: 'User' })
        t.field('attendance', { type: 'Attendance' })     // nullable — absent = null
        t.nonNull.string('status')                         // PRESENT | ON_BREAK | OFF_DUTY | ABSENT
    }
})

export const PaginatedUserAttendance = objectType({
    name: 'PaginatedUserAttendance',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'UserAttendanceEntry' })
        t.nonNull.int('total')
        t.nonNull.int('page')
        t.nonNull.int('limit')
        t.nonNull.boolean('hasMore')
    }
})

export const Shift = objectType({
  name: 'Shift',
  definition(t) {
    t.nonNull.int('id');
    t.nonNull.string('name');

    t.nonNull.field('startTime', { type: 'DateTime' });
    t.nonNull.field('endTime', { type: 'DateTime' });

    t.nonNull.int('breakDuration');

    t.nonNull.int('orgId');

    // Relations
    t.nonNull.list.nonNull.field('attendances', {
      type: 'Attendance',
    });

    t.nonNull.field('org', {
      type: 'Organization',
    });

    t.nonNull.list.nonNull.field('userShifts', {
      type: 'UserShift',
    });
  },
});

export const UserShift = objectType({
  name: 'UserShift',
  definition(t) {
    t.nonNull.int('id');

    t.nonNull.int('userId');
    t.nonNull.int('shiftId');

    t.nonNull.field('assignedAt', {
      type: 'DateTime',
    });

    // Relations
    t.nonNull.field('shift', {
      type: 'Shift',
    });

    t.nonNull.field('user', {
      type: 'User',
    });
  },
});