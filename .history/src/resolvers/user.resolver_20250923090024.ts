import * as userService from '../services/user.service'

const userResolver = {

     Mutation: {
          createUser: async (parent, { username, email, password, role, })=>{
               return await userService.createUser({username, email, password, role,})
          }
     }
}