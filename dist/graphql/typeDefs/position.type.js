import { objectType } from 'nexus';
export const Position = objectType({
    name: 'Position',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('label');
        t.nonNull.int('orgId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.position.findUnique({ where: { id: parent.id } }).org();
            }
        });
    }
});
