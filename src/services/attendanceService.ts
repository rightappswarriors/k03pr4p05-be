import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AttendanceService {
  // Time in for a user's shift
  async timeIn(userId: number, photo?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the user's active shift for today (if any) or create a default shift?
    // For simplicity, we assume there is a default shift for the organization.
    // In a real system, we would have a way to assign shifts to users.
    // We'll fetch the user's assigned shift for today from UserShift.
    const userShift = await prisma.userShift.findFirst({
      where: {
        userId,
        shift: {
          orgId: (await prisma.user.findUnique({ where: { id: userId } }))!.orgId
        }
      },
      include: {
        shift: true
      }
    });

    if (!userShift) {
      throw new Error('No shift assigned to user');
    }

    // Check if there's already an attendance record for today for this user and shift
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        shiftId: userShift.shiftId,
        shiftDate: today
      }
    });

    if (existingAttendance) {
      // If already timed in, throw error or update?
      if (existingAttendance.timeIn) {
        throw new Error('Already timed in today');
      }
      // Update timeIn and photoIn
      return await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          timeIn: new Date(),
          photoIn: photo || undefined,
          status: 'PRESENT'
        }
      });
    }

    // Create new attendance record
    return await prisma.attendance.create({
      data: {
        userId,
        shiftId: userShift.shiftId,
        shiftDate: today,
        timeIn: new Date(),
        photoIn: photo || undefined,
        status: 'PRESENT',
        orgId: (await prisma.user.findUnique({ where: { id: userId } }))!.orgId
      }
    });
  }

  // Start break
  async startBreak(userId: number, photo?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        shiftDate: today,
        status: 'PRESENT'
      }
    });

    if (!attendance) {
      throw new Error('No active attendance record for today');
    }

    if (attendance.breakStart) {
      throw new Error('Break already started');
    }

    return await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        breakStart: new Date(),
        photoBreakStart: photo || undefined,
        status: 'ON_BREAK'
      }
    });
  }

  // End break
  async endBreak(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        shiftDate: today,
        status: 'ON_BREAK'
      }
    });

    if (!attendance) {
      throw new Error('No active break to end');
    }

    if (!attendance.breakStart) {
      throw new Error('Break not started');
    }

    return await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        breakEnd: new Date(),
        photoBreakEnd: undefined, // Not required for end break
        status: 'PRESENT'
      }
    });
  }

  // Time out
  async timeOut(userId: number, photo?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        shiftDate: today,
        status: { in: ['PRESENT', 'ON_BREAK'] }
      }
    });

    if (!attendance) {
      throw new Error('No active attendance record for today');
    }

    if (attendance.timeOut) {
      throw new Error('Already timed out today');
    }

    return await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        timeOut: new Date(),
        photoOut: photo || undefined,
        status: 'OFF_DUTY'
      }
    });
  }

  // Get my attendance for today
  async getMyAttendanceToday(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.attendance.findFirst({
      where: {
        userId,
        shiftDate: today
      },
      include: {
        shift: true,
        user: true,
        org: true
      }
    });
  }

  // Get today's attendance by organization
  async getTodayAttendanceByOrganization(orgId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.attendance.findMany({
      where: {
        orgId,
        shiftDate: today
      },
      include: {
        shift: true,
        user: true,
        org: true
      }
    });
  }
}