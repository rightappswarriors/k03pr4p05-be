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
        return await userService.getAllUsers();
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
        const userId = parseInt(id);
        return await userService.getUserById(userId);
      },
    });
  },
});
