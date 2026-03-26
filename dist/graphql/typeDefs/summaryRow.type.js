import { objectType } from 'nexus';
export const SummaryRow = objectType({
    name: 'SummaryRow',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('itemCode');
        t.nonNull.string('description');
        t.nonNull.float('opExPct');
        t.nonNull.float('computedCost');
        t.nonNull.float('costContribution');
        t.nonNull.float('sellingPrice');
        t.nullable.string('status');
        t.nonNull.int('orgId');
        t.nullable.int('userId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).user();
            }
        });
    }
});
