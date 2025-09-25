import { extendType, arg, nonNull } from "nexus";
import * as userService from "../../../services/user.service.js";

export const branchQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("getOwnedBranches", {
      type: "Branch",
      resolve: async (parent, args, ctx) => {
        if (!ctx.user) {
          console.error("Authentication required");
          throw new Error("Authentication required");
        }
        try {
        } catch (error) {
          console.error("Authentication required");
          throw new Error("Authentication required");

        }
      },
    });
  },
});
