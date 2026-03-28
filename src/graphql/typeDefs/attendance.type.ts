import { objectType } from 'nexus'

export const Shift = objectType({
    name: 'Shift',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('name')
        t.nonNull.dateTime('startTime')
        t.nonNull.dateTime('endTime')
        t.nonNull.int('breakDuration')
        t.nonNull.int('orgId')
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.shift.findUnique({ where: { id: parent.id } }).org()
            }
        })
        t.list.field('userShifts', {
            type: 'UserShift',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.userShift.findMany({ where: { shiftId: parent.id } })
            }
        })
        t.list.field('attendances', {
            type: 'Attendance',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.attendance.findMany({ where: { shiftId: parent.id } })
            }
        })
    }
})

export const UserShift = objectType({
    name: 'UserShift',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.int('userId')
        t.nonNull.int('shiftId')
        t.nonNull.dateTime('assignedAt')
        t.nonNull.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.userShift.findUnique({ where: { id: parent.id } }).user()
            }
        })
        t.nonNull.field('shift', {
            type: 'Shift',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.userShift.findUnique({ where: { id: parent.id } }).shift()
            }
        })
    }
})

export const Attendance = objectType({
    name: 'Attendance',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.int('userId')
        t.nonNull.int('shiftId')
        t.nonNull.dateTime('shiftDate')
        t.nullable.dateTime('timeIn')
        t.nullable.dateTime('timeOut')
        t.nullable.dateTime('breakStart')
        t.nullable.dateTime('breakEnd')
        t.nullable.string('photoIn')
        t.nullable.string('photoOut')
        t.nullable.string('photoBreakStart')
        t.nullable.string('photoBreakEnd')
        t.nonNull.field('status', { type: 'AttendanceStatus' })
        t.nonNull.int('orgId')
        t.nonNull.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.attendance.findUnique({ where: { id: parent.id } }).user()
            }
        })
        t.nonNull.field('shift', {
            type: 'Shift',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.attendance.findUnique({ where: { id: parent.id } }).shift()
            }
        })
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.attendance.findUnique({ where: { id: parent.id } }).org()
            }
        })
    }
})