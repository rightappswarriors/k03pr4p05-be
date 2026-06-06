import { extendType, intArg, nonNull, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const userProfileMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('updateMyProfile', {
            type: 'User',
            args: {
                bio: stringArg(),
                phone: stringArg(),
                address: stringArg(),
                city: stringArg(),
                state: stringArg(),
                zipCode: stringArg(),
                country: stringArg(),
                dateOfBirth: stringArg(),
                profilePhoto: stringArg(),
            },
            resolve: async (_, { bio, phone, address, city, state, zipCode, country, dateOfBirth, profilePhoto }, ctx) => {
                requireAuth(ctx);
                const userId = ctx.user?.userId;
                if (!userId)
                    throw new Error('User is required');
                // Ensure profile exists, create if it doesn't
                let profile = await ctx.prisma.userProfile.findUnique({
                    where: { userId: Number(userId) },
                });
                if (!profile) {
                    profile = await ctx.prisma.userProfile.create({
                        data: { userId: Number(userId) },
                    });
                }
                return ctx.prisma.userProfile.update({
                    where: { userId: Number(userId) },
                    data: {
                        ...(bio !== undefined && { bio }),
                        ...(phone !== undefined && { phone }),
                        ...(address !== undefined && { address }),
                        ...(city !== undefined && { city }),
                        ...(state !== undefined && { state }),
                        ...(zipCode !== undefined && { zipCode }),
                        ...(country !== undefined && { country }),
                        ...(dateOfBirth !== undefined && { dateOfBirth }),
                        ...(profilePhoto !== undefined && { profilePhoto }),
                    },
                });
            },
        });
        t.field('updateUserProfile', {
            type: 'User',
            args: {
                userId: nonNull(intArg()),
                bio: stringArg(),
                phone: stringArg(),
                address: stringArg(),
                city: stringArg(),
                state: stringArg(),
                zipCode: stringArg(),
                country: stringArg(),
                dateOfBirth: stringArg(),
                profilePhoto: stringArg(),
            },
            resolve: async (_, { userId, bio, phone, address, city, state, zipCode, country, dateOfBirth, profilePhoto }, ctx) => {
                requireAuth(ctx);
                const requestingUserId = ctx.user?.userId;
                // Users can only update their own profile
                if (Number(requestingUserId) !== userId) {
                    throw new Error('You can only update your own profile');
                }
                // Ensure profile exists, create if it doesn't
                let profile = await ctx.prisma.userProfile.findUnique({
                    where: { userId },
                });
                if (!profile) {
                    profile = await ctx.prisma.userProfile.create({
                        data: { userId },
                    });
                }
                return ctx.prisma.userProfile.update({
                    where: { userId },
                    data: {
                        ...(bio !== undefined && { bio }),
                        ...(phone !== undefined && { phone }),
                        ...(address !== undefined && { address }),
                        ...(city !== undefined && { city }),
                        ...(state !== undefined && { state }),
                        ...(zipCode !== undefined && { zipCode }),
                        ...(country !== undefined && { country }),
                        ...(dateOfBirth !== undefined && { dateOfBirth }),
                        ...(profilePhoto !== undefined && { profilePhoto }),
                    },
                });
            },
        });
    },
});
