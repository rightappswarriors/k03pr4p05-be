import { objectType } from 'nexus';
export const SupplierOutletLink = objectType({
    name: 'SupplierOutletLink',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('supplierOrgId');
        t.nonNull.int('outletId');
        t.nonNull.boolean('isApproved');
        t.nonNull.dateTime('createdAt');
        t.nonNull.field('supplierOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierOutletLink
                    .findUnique({
                    where: { id: parent.id },
                })
                    .supplierOrg();
            },
        });
        t.nonNull.field('outlet', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierOutletLink
                    .findUnique({
                    where: { id: parent.id },
                })
                    .outlet();
            },
        });
    },
});
