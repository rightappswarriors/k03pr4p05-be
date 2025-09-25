// src/graphql/typeDefs/user.type.ts    
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
          t.nonNull.string('createdAt'); 
          t.nonNull.list.nonNull.field('branchesOwned', {
               type: 'Branch',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                         .findUnique({ where: { id: parent.id}})
                         .branchesOwned()
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
               type: 'OutletStaff',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                    .findUnique({where: { id: parent.id}})
                    .staff()
               }}
          )
          
          t.nonNull.list.field('transaction',{ 
               type: 'Transaction',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                    .findUnique({where: { id: parent.id}})
                    .transaction()
               }}
          )
          t.nullable.field('manager', {
               type: 'User',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.user
                    .findUnique({ where: { id: parent.id}})
                    .manager()
               }
          })
     }
})