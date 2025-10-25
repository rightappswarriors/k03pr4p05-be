// graphql/supplier/supplier.query.js
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
