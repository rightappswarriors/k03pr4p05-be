import { extendType, intArg, stringArg } from 'nexus';
export const positionMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createPosition', {
            type: 'Position',
            args: {
                orgId: intArg(),
                name: stringArg()
            },
            resolve: async (_, { orgId, name }, ctx) => {
                return ctx.prisma.position.create({
                    data: { orgId, name }
                });
            }
        });
        t.field('updatePosition', {
            type: 'Position',
            args: {
                id: intArg(),
                name: stringArg()
            },
            resolve: async (_, { id, name }, ctx) => {
                return ctx.prisma.position.update({
                    where: { id },
                    data: { name }
                });
            }
        });
        t.field('deletePosition', {
            type: 'Position',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.position.delete({
                    where: { id }
                });
            }
        });
    }
});
