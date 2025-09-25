import { extendType, arg, nonNull, nullable } from "nexus";
import {
  requireRole,
  requireAuth,
} from "../../../middleware/auth.middleware.js";

import * as branchService from "../../../services/branch.service.js";

export const branchMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createBranch", {
      type: "Branch",
      args: {
        name: nonNull(arg({ type: "String" })),
        address: nonNull(arg({ type: "String" })),
        phone: nonNull(arg({ type: "String" })),
      },
      async resolve(parent, { name, address, phone }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        if (!name || !address) {
          console.error("Missing required fields: name, address");
          throw new Error("Missing required fields: name, address");
        }
        const branchExists = await ctx.prisma.branch.findFirst({
          where: {
            OR: [{ name: name }, { address: address }],
          },
        });
        if (branchExists) {
          if (branchExists.name === name) {
            throw new Error(`Branch with name "${name}" already exists`);
          } else {
            throw new Error(`Branch with address "${address}" already exists`);
          }
        }
        const ownerId = ctx.user.userId;
        try {
          return await branchService.createBranch(
            { name, address, phone },
            ownerId
          );
        } catch (error) {
          console.error("Error creating Branch:", error);
          throw new Error("Error creating Branch");
        }
      },
    });
  },
});