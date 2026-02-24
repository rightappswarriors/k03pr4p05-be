import { objectType } from 'nexus'

export const PaymongoAPIKeys = objectType({
     name: 'PaymongoAPIKeys',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('public_key')
          //t.nonNull.string('secret_key')
          t.nonNull.field('owner', {
               type: "User",
               resolve: (parent, _, ctx) => {
                    return ctx.prisma.paymongoAPIKeys
                         .findUnique({ where: { id: parent.id } })
                         .owner()
               }
          })
          t.nonNull.list.nonNull.field("outlets", {
               type: "Outlet",
               resolve: (parent, _, ctx) => {
                    return ctx.prisma.paymongoAPIKeys.findUnique({
                         where: {
                              id: parent.id
                         }
                    }).outlets()
               }
          })
     }
})