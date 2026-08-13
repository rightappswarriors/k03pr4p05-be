import { extendType, intArg, nonNull, stringArg } from "nexus";
import bcrypt from "bcrypt";
import { PAGE_PERMISSIONS } from "../../../lib/permissions.map.js";
export const AdminUserMutations = extendType({
    type: "Mutation",
    definition(t) {
        // ─── Verify User ───────────────────────────────────────────────
        t.nonNull.field("verifyUser", {
            type: "User",
            args: { userId: nonNull(intArg()) },
            async resolve(_root, { userId }, ctx) {
                PAGE_PERMISSIONS.admin.edit(ctx);
                const user = await ctx.prisma.user.update({
                    where: { id: userId },
                    data: { isVerified: true },
                    include: {
                        org: { select: { id: true, name: true } },
                        position: { select: { id: true, name: true } },
                        department: { select: { id: true, name: true } },
                    },
                });
                return user;
            },
        });
        // ─── Unverify User ─────────────────────────────────────────────
        t.nonNull.field("unverifyUser", {
            type: "User",
            args: { userId: nonNull(intArg()) },
            async resolve(_root, { userId }, ctx) {
                PAGE_PERMISSIONS.admin.edit(ctx);
                const user = await ctx.prisma.user.update({
                    where: { id: userId },
                    data: { isVerified: false },
                    include: {
                        org: { select: { id: true, name: true } },
                        position: { select: { id: true, name: true } },
                        department: { select: { id: true, name: true } },
                    },
                });
                return user;
            },
        });
        // ─── Ban User ──────────────────────────────────────────────────
        t.nonNull.field("banUser", {
            type: "User",
            args: { userId: nonNull(intArg()) },
            async resolve(_root, { userId }, ctx) {
                PAGE_PERMISSIONS.admin.delete(ctx);
                const user = await ctx.prisma.user.update({
                    where: { id: userId },
                    data: { isActive: false },
                    include: {
                        org: { select: { id: true, name: true } },
                        position: { select: { id: true, name: true } },
                        department: { select: { id: true, name: true } },
                    },
                });
                return user;
            },
        });
        // ─── Unban User ────────────────────────────────────────────────
        t.nonNull.field("unbanUser", {
            type: "User",
            args: { userId: nonNull(intArg()) },
            async resolve(_root, { userId }, ctx) {
                PAGE_PERMISSIONS.admin.edit(ctx);
                const user = await ctx.prisma.user.update({
                    where: { id: userId },
                    data: { isActive: true },
                    include: {
                        org: { select: { id: true, name: true } },
                        position: { select: { id: true, name: true } },
                        department: { select: { id: true, name: true } },
                    },
                });
                return user;
            },
        });
        // ─── Change Password ───────────────────────────────────────────
        t.nonNull.boolean("changeUserPassword", {
            args: {
                userId: nonNull(intArg()),
                password: nonNull(stringArg()),
            },
            async resolve(_root, { userId, password }, ctx) {
                PAGE_PERMISSIONS.admin.edit(ctx);
                const SALT_ROUNDS = 10;
                const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                await ctx.prisma.user.update({
                    where: { id: userId },
                    data: { password: hashedPassword },
                    select: { id: true }, // never return password field
                });
                return true;
            },
        });
    },
});
