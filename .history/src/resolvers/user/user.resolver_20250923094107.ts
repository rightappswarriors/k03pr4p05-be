// src/resolver/user.resolver.ts
import * as userService from '../services/user.service'

export const userResolver = {
     Query: {
          users: async ()=>{
               return await userService.getAllUsers()
          },
          user: async (parent,{ id }) => {
               return await userService.getUserById(id)
          }
     },

     Mutation: {
          createUser: async (parent, { username, email, password, role, })=>{
               return await userService.createUser({username, email, password, role,})
          }
     }
}

