import { mutationType, arg, nonNull} from 'nexus'
import { createUser } from '../../../services/user.service'

export const userMutation = mutationType({
     definition(t) {
          t.nonNull.field('signup', {
               type:'User',
               args: {
                    fullname: nonNull(arg({ type: 'String'})),
                    password: nonNull(arg({ type: 'String'})),
                    email: nonNull(arg({ type: 'String'})),
                    username: nonNull(arg({type:'String'})),
                    role: arg({ type: 'Role'})
               },
               async resolve(parent, { fullname, username, email, password, role}, ctx) {
                    try {
                         const newUser = await createUser({
                              fullname,
                              username,
                              email,
                              password,
                              role
                         })
                         return newUser
                    } catch(error) {
                         throw new Error(`Failed to create user: ${error.message}`);
                    }
               }
                    
          })
          
     }
})