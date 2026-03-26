import { extendType, intArg, stringArg } from 'nexus';
export const subCenterMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createSubCenter', {
            type: 'SubCenter',
            args: {
                orgId: intArg(),
                name: stringArg(),
                centerId: intArg()
            },
            resolve: async (_, { orgId, name, centerId }, ctx) => {
                return ctx.prisma.subCenter.create({
                    data: { orgId, name, centerId }
                });
            }
        });
        t.field('updateSubCenter', {
            type: 'SubCenter',
            args: {
                id: intArg(),
                name: stringArg(),
                centerId: intArg()
            },
            resolve: async (_, { id, name, centerId }, ctx) => {
                return ctx.prisma.subCenter.update({
                    where: { id },
                    data: { name, centerId }
                });
            }
        });
        t.field('deleteSubCenter', {
            type: 'SubCenter',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.subCenter.delete({
                    where: { id }
                });
            }
        });
    }
});
