import { extendType, nonNull, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'
import { AttendanceService } from '../../../services/attendanceService.js'

const attendanceService = new AttendanceService()

export const attendanceMutation = extendType({
  type: 'Mutation',
  definition(t) {

    // ── TIME IN ────────────────────────────────────────────────────────────
    t.field('timeIn', {
      type: 'Attendance',
      args: {
        photoIn: nonNull(stringArg()),    // URL from your file service
        noteIn: nonNull(stringArg())      // what's your plan for today
      },
      resolve: async (_, { photoIn, noteIn }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF', 'CASHIER'])
        return attendanceService.timeIn(ctx.user.userId, photoIn, noteIn)
      }
    })

    // ── START BREAK (out for lunch) ────────────────────────────────────────
    t.field('startBreak', {
      type: 'Attendance',
      args: {
        photoBreakStart: nonNull(stringArg()),
        noteBreakStart: nonNull(stringArg())
      },
      resolve: async (_, { photoBreakStart, noteBreakStart }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF', 'CASHIER'])
        return attendanceService.startBreak(
          ctx.user.userId,
          photoBreakStart,
          noteBreakStart
        )
      }
    })

    // ── END BREAK (in from lunch) ──────────────────────────────────────────
    t.field('endBreak', {
      type: 'Attendance',
      args: {
        photoBreakEnd: nonNull(stringArg()),
        noteBreakEnd: nonNull(stringArg())
      },
      resolve: async (_, { photoBreakEnd, noteBreakEnd }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF', 'CASHIER'])
        return attendanceService.endBreak(
          ctx.user.userId,
          photoBreakEnd,
          noteBreakEnd
        )
      }
    })

    // ── TIME OUT ───────────────────────────────────────────────────────────
    t.field('timeOut', {
      type: 'Attendance',
      args: {
        photoOut: nonNull(stringArg()),
        noteOut: nonNull(stringArg())
      },
      resolve: async (_, { photoOut, noteOut }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ['OWNER', 'STAFF', 'CASHIER'])
        return attendanceService.timeOut(ctx.user.userId, photoOut, noteOut)
      }
    })
  }
})