import { objectType } from 'nexus';
export const PlaceLocation = objectType({
    name: 'PlaceLocation',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('address');
        t.nonNull.float('latitude');
        t.nonNull.float('longitude');
        t.nonNull.int('branchId');
        t.nonNull.field('branch', {
            type: 'Branch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.placeLocation.findUnique({ where: { id: parent.id } }).branch();
            }
        });
    }
});
