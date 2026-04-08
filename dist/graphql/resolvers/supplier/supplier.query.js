/*/ graphql/supplier/supplier.query.js
import { extendType, intArg, nonNull } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as supplierService from "../../../services/supplier.service.js";

export const SupplierQuery = extendType({
  type: "Query",
  definition(t) {
    // Get all suppliers
    t.list.field("getSuppliers", {
      type: "Supplier",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        return await supplierService.getSuppliers();
      },
    });

    // Get supplier by ID
    t.field("getSupplierById", {
      type: "Supplier",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        return await supplierService.getSupplierById(id);
      },
    });
  },
});
*/
// rai-pos-backend/src/graphql/resolvers/supplier/supplier.query.ts
import { extendType, nonNull, stringArg } from 'nexus';
export const SupplierQuery = extendType({
    type: 'Query',
    definition(t) {
        t.field('getSupplierOrder', {
            type: 'SupplierOrder',
            args: { token: nonNull(stringArg()) },
            async resolve(_, { token }, ctx) {
                const order = await ctx.prisma.supplierOrder.findUnique({
                    where: { supplierToken: token },
                    include: { items: { include: { item: true } } },
                });
                if (!order)
                    throw new Error('Invalid or expired link');
                if (new Date() > order.tokenExpiresAt)
                    throw new Error('This link has expired');
                // Don't expose the token itself in the response
                return order;
            },
        });
    },
});
