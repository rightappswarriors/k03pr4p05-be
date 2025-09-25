
import { objectType, enumType } from 'nexus'

export const OutletType = enumType({
     name: 'OutletType',
     members: ['retail', 'wholesale', 'service']
})

export const Outlet = objectType({
     name: 'Outlet',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('name')
          t.nonNull.string('address')
          t.nonNull.string('code')
          
          t.nullable.int('nexTransactionNumber')
          t.nullable.float('govermenttax')
          
          t.nullable.float('serviceCharge')
          t.nonNull.field('outletType', { type: 'OutletType'})
          t.nonNull.string('createdAt')
          t.nullable.string('wifiSSID')
          t.nonNull.boolean('isActive')
          //OwnerID get owner
          t.nonNull.field('owner', {
               type: 'User',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.branch
                    .findUnique({ where: { id: parent.id}})
                    .owner()
               }
          })
          //BranchID get branch
          t.nonNull.list.nonNull.field('branch', {
               type: 'Branch',
               resolve: (parent, args, ctx)=> {
                    return ctx.prisma.branch
                    .findUnique({ where: { id: parent.id}})
                    .branch()
               }
          })
          //OutletStaff
          
          t.nonNull.list.nonNull.field('staff', {
               type: 'OutletStaff',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.outletStaff
                    .findUnique({ where: { id: parent.id}})
                    .staff()
               }
          }) 

          t.nonNull.list.nonNull.field('devices', {
               type: 'Device',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.device.findUnique({
                         where: { id: parent.id}
                    }).device()
               }
          })
          t.nonNull.list.nonNull.field('transaction', {
               type: 'Transaction',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.transaction.findUnique({
                         where: { id: parent.id}
                    }).transaction()
               }
          })
     }}
)