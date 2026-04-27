import {
  extendType,
  arg,
  nonNull,
  nullable,
  list,
  inputObjectType,
  objectType,
  floatArg,
  booleanArg,
  intArg
} from "nexus";
import {
  requireRole,
  requireAuth,
  requireOwnership,
} from "../../../middleware/auth.middleware.js";
import * as outletService from "../../../services/outlet.service.js";
export const OutletStaffInput = inputObjectType({
  name: "OutletStaffInput",
  definition(t) {
    t.nonNull.int("userId");
    t.nullable.string("role");
  },
});
import * as outletPromoService from "../../../services/outletPromo.service.js";

export const OutletPromoInput = inputObjectType({
  name: "OutletPromoInput",
  definition(t) {
    t.nonNull.int("promoTypeId");
    t.nonNull.float("discount");
    t.nullable.boolean("isActive");
  },
});

export const AddedOutletStaffs = objectType({
  name: "AddedOutletStaffs",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.list.nonNull.field("staff", { type: "User" });
  },
});

export const outletMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createOutlet", {
      type: "Outlet",
      args: {

        name: nonNull(arg({ type: "String" })),
        address: nonNull(arg({ type: "String" })),
        branchId: nonNull(arg({ type: "ID" })),
        phone: nullable(arg({ type: "String" })),
        code: nonNull(arg({ type: "String" })),
        isActive: nullable(booleanArg()),
        status: nullable(arg({ type: "OutletStatus" })),
        governmentTax: nonNull(arg({ type: "Float" })),
        serviceCharge: nonNull(arg({ type: "Float" })),
        outletType: nonNull(arg({ type: "OutletType" })),
        longitude: nullable(arg({ type: "Float" })),
        latitude: nullable(floatArg()),
        bannerImage: nullable(arg({ type: "String" })),
        tin: nullable(arg({ type: "String" })),
        ptu: nullable(arg({ type: "String" })),
        bir: nullable(arg({ type: "String" })),
        isVatRegistered: nullable(booleanArg()),
        vatZeroSale: nullable(arg({ type: "Float" })),
        vatTypeId: nullable(intArg()),
        outletPromos: nullable(list(nonNull(arg({ type: "OutletPromoInput" })))),
      },
      async resolve(_, {
        branchId, name, address, phone, code,
        governmentTax, serviceCharge, outletType,
        longitude, latitude, status, isActive, bannerImage,
        tin, ptu, bir, isVatRegistered, vatZeroSale, vatTypeId,
        outletPromos   // ← new
      }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "OWNER"]);
        const userId = ctx.user.userId;

        try {
          const outlet = await outletService.createOutlet(
            {
              name, address, phone: phone || null, code,
              governmentTax, serviceCharge, outletType,
              longitude, latitude, status, isActive,
              bannerImage: bannerImage || null,
              tin: tin || null,
              ptu: ptu || null,
              bir: bir || null,
              isVatRegistered: isVatRegistered ?? false,
              vatZeroSale: vatZeroSale ?? 0,
              ...(vatTypeId ? { vatType: { connect: { id: vatTypeId } } } : {}),
            },
            Number(branchId),
            Number(userId)
          );

          // Create outlet promos if provided
          if (outletPromos?.length) {
            await Promise.all(
              outletPromos.map((p: any) =>
                outletPromoService.createOutletPromo({
                  outletId: Number(outlet.id),
                  promoTypeId: p.promoTypeId,
                  discount: p.discount,
                  isActive: p.isActive ?? true,
                  userId: Number(userId),
                })
              )
            );
          }

          return outlet;
        } catch (error: any) {
          if (error.code === "P2002") {
            const target = error.meta?.target;
            if (target.includes("name")) {
              throw new Error(`Outlet with this name already exists`);
            }
            if (target.includes("code")) {
              throw new Error(`Outlet with this code already exists`);
            }
            throw new Error("A unique constraint failed");
          }
          if (process.env.NODE_ENV === "development") console.error("Error creating outlet", error);
          throw new Error("Error creating outlet");
        }
      },
    });
    t.nonNull.field("AddOutletStaff", {
      type: "AddedOutletStaffs",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
        users: nonNull(arg({ type: list(nonNull("OutletStaffInput")) })),
      },
      async resolve(_, { outletId, users }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        await requireOwnership(ctx, "Outlet", outletId);
        try {
          if (Array.isArray(users)) {
            if (users.length === 0) {
              throw new Error(
                "Request body must be a non-empty array of users."
              );
            }
            return await outletService.addStaffsToOutlet(Number(outletId), users);
          } else {
            const { userId, role } = users;
            if (!userId || !role) {
              // Use 400 for a bad request (missing data)
              throw new Error("Missing required fields: userId and role");
            }
            return await outletService.addStaffToOutlet(
              Number(outletId),
              Number(userId),
              role
            );
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error(
            "An unexpected error occurred while adding staff:",
            error
          );
          throw new Error("An unexpected error occurred while adding staff.");
        }
      },
    });
    t.nonNull.field("deleteOutletStaffs", {
      type: "OutletStaff",
      args: {
        id: nonNull(arg({ type: "ID" })),
        userIds: nonNull(arg({ type: nonNull(list(nonNull("ID"))) })),
      },
      async resolve(_, { id, userIds }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        await requireOwnership(ctx, "Outlet", id);
        if (
          !id ||
          !userIds ||
          !Array.isArray(userIds) ||
          userIds.length === 0
        ) {
          throw new Error("Store ID and at least one User ID are required.");
        }
        try {
          return await outletService.removeStaffsFromOutlet(
            Number(id),
            userIds
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error(
            "An unexpected error has occured while deleting staffs: ",
            error
          );
          throw new Error(
            "An unexpected error has occured while deleting staffs"
          );
        }
      },
    });
    t.nonNull.field("updateOutlet", {
      type: "Outlet",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
        name: nullable(arg({ type: "String" })),
        address: nullable(arg({ type: "String" })),
        phone: nullable(arg({ type: "String" })),
        code: nullable(arg({ type: "String" })),
        status: nullable(arg({ type: "OutletStatus" })),
        isActive: nullable(booleanArg()),
        governmentTax: nullable(arg({ type: "Float" })),
        serviceCharge: nullable(arg({ type: "Float" })),
        outletType: nullable(arg({ type: "OutletType" })),
        longitude: nullable(arg({ type: "Float" })),
        latitude: nullable(floatArg()),
        bannerImage: nullable(arg({ type: "String" })),
        tin: nullable(arg({ type: "String" })),
        ptu: nullable(arg({ type: "String" })),
        bir: nullable(arg({ type: "String" })),
        isVatRegistered: nullable(booleanArg()),
        vatZeroSale: nullable(arg({ type: "Float" })),
        vatTypeId: nullable(intArg()),
        outletPromos: nullable(list(nonNull(arg({ type: "OutletPromoInput" })))),
      },
      async resolve(
        _,
        {
          outletId,
          name,
          address,
          phone,
          code,
          governmentTax,
          serviceCharge,
          outletType,
          status,
          latitude,
          longitude,
          isActive,
          bannerImage,
          tin, ptu, bir, isVatRegistered, vatZeroSale, vatTypeId,
          outletPromos
        },
        ctx
      ) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "OWNER"]);
        await requireOwnership(ctx, "Outlet", outletId);
        // Ensure at least one field to update
        if (
          name === undefined &&
          address === undefined &&
          phone === undefined &&
          code === undefined &&
          governmentTax === undefined &&
          serviceCharge === undefined &&
          outletType === undefined &&
          status === undefined &&
          latitude === undefined &&
          longitude === undefined &&
          isActive === undefined &&
          bannerImage === undefined
        ) {
          throw new Error(
            "At least one field is required to update the outlet."
          );
        }

        try {
          const updateData: any = {};
          if (name !== undefined && name !== null) updateData.name = name;
          if (address !== undefined && address !== null)
            updateData.address = address;
          if (phone !== undefined && phone !== null) updateData.phone = phone;
          if (code !== undefined && code !== null) updateData.code = code;
          if (governmentTax !== undefined && governmentTax !== null)
            updateData.governmentTax = governmentTax;
          if (serviceCharge !== undefined && serviceCharge !== null)
            updateData.serviceCharge = serviceCharge;
          if (outletType !== undefined && outletType !== null)
            updateData.outletType = outletType;
          if (status !== undefined && status !== null)
            updateData.status = status;
          if (latitude !== undefined && latitude !== null)
            updateData.latitude = latitude;
          if (longitude !== undefined && longitude !== null)
            updateData.longitude = longitude;
          if (isActive !== undefined && isActive !== null)
            updateData.isActive = isActive;
          if (bannerImage !== undefined && bannerImage !== null)
            updateData.bannerImage = bannerImage;
          // In the resolver updateData block, add:
          if (tin !== undefined) updateData.tin = tin;
          if (ptu !== undefined) updateData.ptu = ptu;
          if (bir !== undefined) updateData.bir = bir;
          if (isVatRegistered !== undefined) updateData.isVatRegistered = isVatRegistered;
          if (vatZeroSale !== undefined) updateData.vatZeroSale = vatZeroSale;
          if (vatTypeId !== undefined) updateData.vatTypeId = vatTypeId;

          const updated = await outletService.updateOutlet(Number(outletId),
            updateData
          );
          // Upsert promos if provided
          if (outletPromos?.length) {
            await Promise.all(
              outletPromos.map((p: any) =>
                outletPromoService.upsertOutletPromo({
                  outletId: Number(outletId),
                  promoTypeId: p.promoTypeId,
                  discount: p.discount,
                  isActive: p.isActive ?? true,
                  userId: Number(ctx.user.userId),
                })
              )
            );
          }
          return updated;

        } catch (error: any) {
          if (error.code === "P2002") {
            const target = error.meta?.target;
            if (target.includes("name")) {
              throw new Error(`Outlet with this name already exists`);
            }
            if (target.includes("code")) {
              throw new Error(`Outlet with this code already exists`);
            }
            throw new Error("A unique constraint failed");
          }
          if (process.env.NODE_ENV === "development") console.error("Error updating outlet", error);
          throw new Error("Error updating outlet");
        }
      },
    });
    t.nonNull.field("deleteOutlet", {
      type: "Outlet",
      args: {
        id: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);
        await requireOwnership(ctx, "Outlet", id);
        if (!id) {
          throw new Error("Please select Outlet to delete");
        }
        try {
          return await outletService.deleteOutlet(Number(id));
        } catch (error: any) {
          if (error.code === "P2025") {
            throw new Error("Outlet not found.");
          }
          if (process.env.NODE_ENV === "development") console.error("Error deleting Outlet", error);
          throw new Error("Error deleting Outlet");
        }
      },
    });
  },
});
