import { objectType } from 'nexus';
export const UnauthorizedAccess = objectType({
    name: 'UnauthorizedAttempt',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('outletId');
        t.nonNull.string('attemptedDeviceId');
        t.nonNull.string('timestamp');
    }
});
