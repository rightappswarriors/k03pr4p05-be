import { extendType, objectType, floatArg, intArg } from "nexus";
import { PAGE_PERMISSIONS } from "../../../lib/permissions.map.js";

// ─── Return Type ───────────────────────────────────────────────────────────────
export const UserManagementStats = objectType({
  name: "UserManagementStats",
  definition(t) {
    t.nonNull.int("totalUsers");
    t.nonNull.int("activeUsers");
    t.nonNull.int("inactiveUsers");
    t.nonNull.int("verifiedUsers");
    t.nonNull.int("unverifiedUsers");
    t.nonNull.int("newUsersToday");
    t.nonNull.int("newUsersThisMonth");
    t.nonNull.float("verificationRate");
    t.nonNull.float("activeRate");
  },
});

// ─── Query ─────────────────────────────────────────────────────────────────────
export const UserManagementStatsQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("userManagementStats", {
      type: "UserManagementStats",
      async resolve(_root, _args, ctx) {
       PAGE_PERMISSIONS.admin.view(ctx)

        const now = new Date();

        // ─── Today range ─────────────────────────────────────────────
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        // ─── This month range ────────────────────────────────────────
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // ─── Parallel Prisma queries ─────────────────────────────────
        const [
          totalUsers,
          activeUsers,
          verifiedUsers,
          newUsersToday,
          newUsersThisMonth,
        ] = await Promise.all([
          ctx.prisma.user.count(),
          ctx.prisma.user.count({ where: { isActive: true } }),
          ctx.prisma.user.count({ where: { isVerified: true } }),
          ctx.prisma.user.count({
            where: { createdAt: { gte: startOfToday, lte: endOfToday } },
          }),
          ctx.prisma.user.count({
            where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          }),
        ]);

        const inactiveUsers = totalUsers - activeUsers;
        const unverifiedUsers = totalUsers - verifiedUsers;

        // ─── Rates (guard division by zero) ─────────────────────────
        const verificationRate =
          totalUsers > 0
            ? parseFloat(((verifiedUsers / totalUsers) * 100).toFixed(1))
            : 0;

        const activeRate =
          totalUsers > 0
            ? parseFloat(((activeUsers / totalUsers) * 100).toFixed(1))
            : 0;

        return {
          totalUsers,
          activeUsers,
          inactiveUsers,
          verifiedUsers,
          unverifiedUsers,
          newUsersToday,
          newUsersThisMonth,
          verificationRate,
          activeRate,
        };
      },
    });
  },
});