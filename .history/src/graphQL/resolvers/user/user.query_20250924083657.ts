import { extendType, arg, nonNull } from "nexus";
import * as userService from "../../../services/user.service.js";
export const userQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getAllUsers", {
      type: "User",

      resolve: async (parent, args, ctx) => {
        if (!ctx.user) {
          console.error("Authentication required");
          throw new Error("Authentication required");
        }
        try {
          return await userService.getAllUsers();
        } catch (error) {
          console.error("Error getting all user data:", error);
          throw new Error("Error getting all user data:", error.message);
        }
      },
    });
    t.field("getUserById", {
      type: "User",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      resolve: async (parent, { id }, ctx) => {
        if (!ctx.user) {
          console.error("Authentication required");
          throw new Error("Authentication required");
        }
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
