import { extendType, arg, nonNull } from "nexus";
import * as userService from "../../../services/user.service.js";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
export const userQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getAllUsers", {
      type: "User",

      resolve: async (_, __, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        try {
          return await userService.getAllUsers();
        } catch (error) {
          console.error("Error getting all user data:", error);
          throw new Error("Error getting all user data:", error.message);
        }
      },
    });
    t.nonNull.list.nonNull.field("getAllStaffs", {
      type: "User",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        const managerId = ctx.user.userId
        try {
          return await userService.getAllStaffs(Number(managerId));
        } catch (error) {
          console.error("Error getting all user data:", error);
          throw new Error("Error getting all user data:", error.message);
        }
      }
    })
    t.nonNull.field("getUserById", {
      type: "User",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      resolve: async (parent, { id }, ctx) => {
        requireAuth(ctx);
        try {
          const userId = parseInt(id);
          return await userService.getUserById(userId);
        } catch (error) {
          console.error("Error getting all user data:", error);
          throw new Error("Error getting all user data:", error.message);
        }
      },
    });
  },
});
