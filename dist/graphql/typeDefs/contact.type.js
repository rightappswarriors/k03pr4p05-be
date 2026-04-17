// graphql/types/contact/contactType.ts
import { objectType } from 'nexus';
export const Contact = objectType({
    name: 'Contact',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nullable.int('branchId'); // null = global, set = branch-specific
        t.nonNull.string('label'); // Display label / nickname
        t.nonNull.string('name'); // Full name
        t.nonNull.string('email');
        t.nullable.string('phone');
        t.nullable.string('position');
        t.nullable.string('department');
        t.nullable.string('notes');
        t.nonNull.boolean('isActive');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.contact
                    .findUnique({ where: { id: parent.id } })
                    .org();
            },
        });
        t.nullable.field('branch', {
            type: 'Branch',
            resolve: (parent, _, ctx) => {
                if (!parent.branchId)
                    return null;
                return ctx.prisma.contact
                    .findUnique({ where: { id: parent.id } })
                    .branch();
            },
        });
    },
});
