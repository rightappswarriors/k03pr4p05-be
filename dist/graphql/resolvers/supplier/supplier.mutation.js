// graphql/supplier/supplier.mutation.js
/*import { extendType, nonNull, stringArg, intArg } from "nexus";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";
import * as supplierService from "../../../services/supplier.service.js";

export const SupplierMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Create supplier
    t.field("createSupplier", {
      type: "Supplier",
      args: {
        name: nonNull(stringArg()),
        address: stringArg(),
        zipCode: stringArg(),
        contactNumber: nonNull(stringArg()),
        contactName: nonNull(stringArg()),
        faxNumber: stringArg(),
        tinNumber: stringArg(),
      },
      async resolve(_, args, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await supplierService.createSupplier(args);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error creating supplier:", error);
          throw new Error("Failed to create supplier.");
        }
      },
    });

    // Update supplier
    t.field("updateSupplier", {
      type: "Supplier",
      args: {
        id: nonNull(intArg()),
        name: stringArg(),
        address: stringArg(),
        zipCode: stringArg(),
        contactNumber: stringArg(),
        contactName: stringArg(),
        faxNumber: stringArg(),
        tinNumber: stringArg(),
      },
      async resolve(_, { id, ...data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await supplierService.updateSupplier(id, data);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error updating supplier:", error);
          throw new Error("Failed to update supplier.");
        }
      },
    });

    // Delete supplier
    t.boolean("deleteSupplier", {
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          await supplierService.deleteSupplier(id);
          return true;
        } catch (error) {
          if (error.code === "P2025") {
            throw new Error("Supplier not found.");
          }
          if (process.env.NODE_ENV === "development") console.error("Error deleting supplier:", error);
          throw new Error("Failed to delete supplier.");
        }
      },
    });
  },
});
*/ 
