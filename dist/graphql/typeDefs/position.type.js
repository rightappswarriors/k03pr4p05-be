import { objectType } from 'nexus';
export const Position = objectType({
    name: 'Position',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nullable.string('description');
        t.nonNull.int('orgId');
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.position.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nonNull.list.nonNull.field('permissions', {
            type: 'PositionPermission',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.positionPermission.findMany({
                    where: { positionId: parent.id }
                });
            }
        });
        t.nonNull.list.nonNull.field('controlPermissions', {
            type: 'PositionControlPermission',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.positionControlPermission.findMany({
                    where: { positionId: parent.id }
                });
            }
        });
        t.nonNull.list.nonNull.field('users', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user.findMany({
                    where: { positionId: parent.id }
                });
            }
        });
    }
});
