import { extendType } from 'nexus';
export const organizationQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('organizations', {
            type: 'Organization',
            resolve: async (_, __, ctx) => {
                return ctx.prisma.organization.findMany();
            }
        });
        t.field('organization', {
            type: 'Organization',
            args: { id: 'Int' },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id } });
            }
        });
    }
});
