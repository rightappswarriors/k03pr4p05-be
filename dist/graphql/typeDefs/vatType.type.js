import { objectType } from 'nexus';
export const VatType = objectType({
    name: 'VatType',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nonNull.float('rate');
        t.nonNull.int('orgId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.vatType.findUnique({ where: { id: parent.id } }).org();
            }
        });
    }
});
