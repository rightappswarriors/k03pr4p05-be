import {objectType, enumType } from 'nexus'

export const Role = enumType({
     name: 'Role',
     members: ['ADMIN', 'USER']
})

export const User = objectType({
     name: 'User',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('fullname')
          t.nonNull.string('email')
          t.nonNull.string('password')
          t.nonNull.field('role', { type: 'Role'})
          t.nullable.string('profilePhoto')
          t.nonNull.list.nonNull.field('branchOwned', {
               type: 'Branch',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                         .findUnique({ where: { id: parent.id}})
                         .branchOwned()
               }
          })
          t.nonNull.list.nonNull.field('outletOwned', {
               type: 'Outlet',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                    .findUnique({where: { id: parent.id}})
                    .outletOwned()
               }
          })
          t.nonNull.list.field('staff',{ 
               type: 'Staff',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                    .findUnique({where: { id: parent.id}})
                    .staff()
               }}
          )
     }
})