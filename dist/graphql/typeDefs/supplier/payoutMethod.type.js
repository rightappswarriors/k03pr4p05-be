import { objectType } from 'nexus';
export const PayoutMethod = objectType({
    name: 'PayoutMethod',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nonNull.field('type', {
            type: 'PayoutMethodType',
        });
        t.nonNull.string('accountName');
        t.nonNull.string('maskedAccountNumber');
        t.nullable.string('bankName');
        t.nonNull.boolean('isVerified');
        t.nonNull.boolean('isDefault');
        t.nullable.dateTime('verifiedAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('organization', {
            type: 'Organization',
        });
        t.nonNull.list.nonNull.field('withdrawals', {
            type: 'Withdrawal',
        });
    },
});
