import { extendType, intArg } from 'nexus';
export const placeLocationQuery = extendType({
    type: 'Query',
    definition(t) {
        t.list.field('placeLocations', {
            type: 'PlaceLocation',
            args: {
                orgId: intArg()
            },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.placeLocation.findMany({
                    where: { orgId }
                });
            }
        });
        t.field('placeLocation', {
            type: 'PlaceLocation',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                return ctx.prisma.placeLocation.findUnique({
                    where: { id }
                });
            }
        });
    }
});
