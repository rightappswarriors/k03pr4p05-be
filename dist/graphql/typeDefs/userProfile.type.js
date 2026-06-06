import { objectType } from 'nexus';
export const UserProfile = objectType({
    name: 'UserProfile',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('userId');
        t.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => ctx.prisma.user.findUnique({ where: { id: parent.userId } }),
        });
        t.nullable.string('bio');
        t.nullable.string('phone');
        t.nullable.string('address');
        t.nullable.string('city');
        t.nullable.string('state');
        t.nullable.string('zipCode');
        t.nullable.string('country');
        t.nullable.string('dateOfBirth');
        t.nullable.string('profilePhoto');
        t.nullable.string('department');
        t.nullable.string('position');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});
