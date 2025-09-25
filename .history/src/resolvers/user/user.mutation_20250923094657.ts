import { mutationType, arg, nonNull} from 'nexus'
import { createUser } from '../../services/user.service'

export const Mutation = mutationType({
     definition(t) {
          t.nonNull.field('signup', {
               type:'User',
               args: {
                    fullname: nonNull(arg({ type: 'String'})),
                    password: nonNull(arg({ type: 'String'})),
                    email: nonNull(arg({ type: 'String'})),
                    username: nonNull(arg({type:'String'})),
                    role: arg({ type: 'Role'})
               }
          })
     }
})