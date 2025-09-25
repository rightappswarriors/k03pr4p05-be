
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
          t.nullable.string('name')
          t.nonNull.string('createdAt')
          t.nonNull.boolean('isActive')
          t.nonNull.field('owner', {
               type: 'User',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.branch
                    .findUnique({ where: { id: parent.id}})
                    .owner()
               }
          })
          t.nonNull.list.nonNull.field('outlets', {
               type: 'Outlet',
               resolve: (parent, args, ctx)=> {
                    return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id}})
                    .outlets()
               }
          })
     }}
)