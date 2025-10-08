import { objectType} from 'nexus'

export const  UnauthorizedAccess = objectType({
     name: 'PaymongoAPIKeys',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('public_key')
          t.nonNull.string('secret_key')
     }
})