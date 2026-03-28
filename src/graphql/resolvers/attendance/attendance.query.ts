import { extendType, intArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { AttendanceService } from '../../../services/attendanceService'

const attendanceService = new AttendanceService()

export const attendanceQuery = extendType({
  type: 'Query',
  definition(t) {
    t.field('getMyAttendanceToday', {
      type: 'Attendance',
      resolve: async (_, __, ctx) => {
        requireAuth(ctx)
        const userId = ctx.userId
        return attendanceService.getMyAttendanceToday(userId)
      }
    })
    t.list.field('getTodayAttendanceByOrganization', {
      type: 'Attendance',
      args: {
        orgId: intArg()
      },
      resolve: async (_, { orgId }, ctx) => {
        requireAuth(ctx)
        // Optionally, check if the user is allowed to view this org's data (e.g., same org or admin)
        return attendanceService.getTodayAttendanceByOrganization(orgId)
      }
    })
  }
})