import { extendType, intArg, stringArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'

export const employeeMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createEmployee', {
      type: 'Employee',
      args: {
        orgId: intArg(),
        name: stringArg(),
        positionId: intArg(),
        departmentId: intArg()
      },
      resolve: async (_, { orgId, name, positionId, departmentId }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.employee.create({
          data: { orgId, name, positionId, departmentId }
        })
      }
    })
    t.field('updateEmployee', {
      type: 'Employee',
      args: {
        id: intArg(),
        name: stringArg(),
        positionId: intArg(),
        departmentId: intArg()
      },
      resolve: async (_, { id, name, positionId, departmentId }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.employee.update({
          where: { id },
          data: { name, positionId, departmentId }
        })
      }
    })
    t.field('deleteEmployee', {
      type: 'Employee',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.employee.delete({
          where: { id }
        })
      }
    })
  }
})