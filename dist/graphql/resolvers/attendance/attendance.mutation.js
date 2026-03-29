import { extendType, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { AttendanceService } from '../../../services/attendanceService.js';
const attendanceService = new AttendanceService();
export const attendanceMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('timeIn', {
            type: 'Attendance',
            args: {
                photo: stringArg()
            },
            resolve: async (_, { photo }, ctx) => {
                requireAuth(ctx);
                const userId = ctx.userId; // Assuming we have userId in context from auth middleware
                return attendanceService.timeIn(userId, photo);
            }
        });
        t.field('startBreak', {
            type: 'Attendance',
            args: {
                photo: stringArg()
            },
            resolve: async (_, { photo }, ctx) => {
                requireAuth(ctx);
                const userId = ctx.userId;
                return attendanceService.startBreak(userId, photo);
            }
        });
        t.field('endBreak', {
            type: 'Attendance',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                const userId = ctx.userId;
                return attendanceService.endBreak(userId);
            }
        });
        t.field('timeOut', {
            type: 'Attendance',
            args: {
                photo: stringArg()
            },
            resolve: async (_, { photo }, ctx) => {
                requireAuth(ctx);
                const userId = ctx.userId;
                return attendanceService.timeOut(userId, photo);
            }
        });
    }
});
