import { objectType } from 'nexus';
export const GISRow = objectType({
    name: 'GISRow',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('main');
        t.nonNull.string('group');
        t.nonNull.string('code');
        t.nonNull.string('description');
        t.nonNull.float('debit');
        t.nonNull.float('credit');
        t.nonNull.float('total');
        t.nonNull.int('orgId');
        t.nullable.int('userId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gisRow.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gisRow.findUnique({ where: { id: parent.id } }).user();
            }
        });
    }
});
