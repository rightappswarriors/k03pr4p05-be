
import { objectType } from 'nexus'


export const Branch = objectType({
     name: 'Branch',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('name')
          t.nonNull.string('address')
          t.nullable.string('name')
          t.nonNull.string('createAt')
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