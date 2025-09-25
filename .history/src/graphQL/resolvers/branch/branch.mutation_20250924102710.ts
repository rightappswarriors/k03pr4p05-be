import { extendType, arg, nonNull, nullable } from "nexus";
import {
  requireRole,
  requireAuth,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";

import * as branchService from "../../../services/branch.service.js";

export const branchMutation = extendType({
  type: "Mutation",
  definition(t) {
    // CREATE
    t.nonNull.field("createBranch", {
      type: "Branch",
      args: {
        name: nonNull(arg({ type: "String" })),
        address: nonNull(arg({ type: "String" })),
        phone: nonNull(arg({ type: "String" })),
      },
      async resolve(_, { name, address, phone }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        if (!name || !address) {
          throw new Error("Missing required fields: name, address");
        }

        const branchExists = await ctx.prisma.branch.findFirst({
          where: { OR: [{ name }, { address }] },
        });

        if (branchExists) {
          if (branchExists.name === name) {
            throw new Error(`Branch with name "${name}" already exists`);
          } else {
            throw new Error(`Branch with address "${address}" already exists`);
          }
        }

        const ownerId = ctx.user.userId;
        return branchService.createBranch({ name, address, phone }, ownerId);
      },
    });

    // UPDATE
    t.nonNull.field("updateBranch", {
      type: "Branch",
      args: {
        id: nonNull(arg({ type: "ID" })),
        name: nullable(arg({ type: "String" })),
        address: nullable(arg({ type: "String" })),
        phone: nullable(arg({ type: "String" })),
      },
      async resolve(_, { id, name, address, phone }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        await requireOwnership(ctx, "branch", id);

        const branchExists = await ctx.prisma.branch.findFirst({
          where: {
            OR: [
              name ? { name } : undefined,
              address ? { address } : undefined,
            ].filter(Boolean),
          },
        });

        if (branchExists) {
          if (name && branchExists.name === name) {
            throw new Error(`Branch with name "${name}" already exists`);
          }
          if (address && branchExists.address === address) {
            throw new Error(`Branch with address "${address}" already exists`);
          }
        }

        return branchService.updateBranch(Number(id), { name, address, phone });
      },
    });

    // DELETE
    t.nonNull.field("deleteBranch", {
      type: "Branch",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        await requireOwnership(ctx, "branch", id);

        return branchService.deleteBranch(Number(id));
      },
    });
  },
});
