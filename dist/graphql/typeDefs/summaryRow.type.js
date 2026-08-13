import { objectType } from 'nexus';
export const SummaryRow = objectType({
    name: 'SummaryRow',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('itemCode');
        t.nonNull.string('description');
        t.nonNull.float('baseCost');
        t.float('vatInput');
        t.nonNull.float('sellingPrice');
        t.float('vatOutput');
        t.nonNull.float('opExPct');
        t.nonNull.float('opExAmount');
        t.nonNull.float('grossProfit');
        t.nonNull.float('netProfit');
        t.nullable.string('status');
        t.nonNull.float('amount');
        t.nonNull.float('computedCost');
        t.nonNull.float('costContribution');
        t.nonNull.int('centerId');
        t.nonNull.int('subCenterId');
        t.nonNull.int('accountTitleId');
        t.nonNull.int('orgId');
        t.nullable.int('itemId'); // ← was nonNull, now nullable
        t.nullable.string('itemName');
        t.nullable.json('costLines');
        t.nullable.int('userId');
        t.nonNull.int('vatTypeId');
        t.nonNull.dateTime('createdAt');
        t.nullable.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                if (!parent.itemId)
                    return null; // ← guard added
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).item();
            }
        });
        t.nonNull.field('vatType', {
            type: 'VatType',
            resolve: (parent, _, ctx) => ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).vatType()
        });
        t.nonNull.field('accountTitle', {
            type: 'AccountTitle',
            resolve: (parent, _, ctx) => ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).accountTitle()
        });
        t.nonNull.field('center', {
            type: 'Center',
            resolve: (parent, _, ctx) => ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).center()
        });
        t.nonNull.field('subCenter', {
            type: 'SubCenter',
            resolve: (parent, _, ctx) => ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).subCenter()
        });
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).org()
        });
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                if (!parent.userId)
                    return null; // ← guard added
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).user();
            }
        });
    }
});
