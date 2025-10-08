import { objectType} from 'nexus'

export const  UnauthorizedAccess = objectType({
     name: 'PaymongoAPIKeys',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('attemptedDeviceId')
          t.nonNull.string('timestamp')
     }
})