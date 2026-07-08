import { objectType } from 'nexus';
export const MandateOffer = objectType({
    name: 'MandateOffer',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('mandateId');
        t.nonNull.int('supplierOrgId');
        t.nonNull.float('price');
        t.nonNull.float('availableQty');
        t.nullable.string('terms');
        t.nonNull.field('status', {
            type: 'MandateOfferStatus',
        });
        t.nullable.dateTime('expiresAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('mandate', {
            type: 'Mandate',
        });
        t.nonNull.field('supplierOrg', {
            type: 'Organization',
        });
    },
});
