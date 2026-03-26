import { extendType, intArg, stringArg, floatArg } from 'nexus'

export const salesOrderMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createSalesOrder', {
      type: 'SalesOrder',
      args: {
        orgId: intArg(),
        customerName: stringArg(),
        totalAmount: floatArg(),
        status: stringArg()
      },
      resolve: async (_, { orgId, customerName, totalAmount, status }, ctx) => {
        return ctx.prisma.salesOrder.create({
          data: { orgId, customerName, totalAmount, status }
        })
      }
    })
    t.field('updateSalesOrder', {
      type: 'SalesOrder',
      args: {
        id: intArg(),
        customerName: stringArg(),
        totalAmount: floatArg(),
        status: stringArg()
      },
      resolve: async (_, { id, customerName, totalAmount, status }, ctx) => {
        return ctx.prisma.salesOrder.update({
          where: { id },
          data: { customerName, totalAmount, status }
        })
      }
    })
    t.field('deleteSalesOrder', {
      type: 'SalesOrder',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        return ctx.prisma.salesOrder.delete({
          where: { id }
        })
      }
    })
  }
})