import { extendType, intArg, stringArg } from 'nexus';
export const organizationMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createOrganization', {
            type: 'Organization',
            args: {
                name: stringArg()
            },
            resolve: async (_, { name }, ctx) => {
                return ctx.prisma.organization.create({
                    data: { name }
                });
            }
        });
        t.field('updateOrganization', {
            type: 'Organization',
            args: {
                id: intArg(),
                name: stringArg()
            },
            resolve: async (_, { id, name }, ctx) => {
                return ctx.prisma.organization.update({
                    where: { id },
                    data: { name }
                });
            }
        });
    }
});
