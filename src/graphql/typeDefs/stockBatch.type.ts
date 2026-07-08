import { objectType } from 'nexus';

export const StockBatch = objectType({
  name: 'StockBatch',
  definition(t) {
    t.nonNull.int('id');

    t.nullable.dateTime('deletedAt');

    t.nonNull.int('itemId');
    t.nonNull.int('orgId');
    t.nullable.int('orderId');

    t.nonNull.float('quantity');
    t.nonNull.float('remainingQty');

    t.nullable.dateTime('expiryStartDate');
    t.nullable.dateTime('expiryEndDate');
    t.nullable.dateTime('exactExpiryDate');

    t.nonNull.dateTime('receivedAt');

    t.nonNull.field('item', {
      type: 'Item',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.stockBatch.findUnique({
          where: { id: parent.id },
        }).item();
      },
    });

    t.nonNull.field('org', {
      type: 'Organization',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.stockBatch.findUnique({
          where: { id: parent.id },
        }).org();
      },
    });
  },
});