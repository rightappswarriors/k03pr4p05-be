import { objectType } from 'nexus';
export const Brand = objectType({
    name: 'Brand',
    definition(t) {
        t.nonNull.int('id');
        t.nullable.string('email');
        t.nullable.string('webUrl');
        t.nullable.string('contactNumber');
        t.nullable.string('name');
        t.nonNull.list.nonNull.field('Item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                // Correct: Use Prisma's relational query to get the cart items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).Item();
            }
        });
    }
});
