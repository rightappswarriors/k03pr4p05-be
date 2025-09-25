import { objectType, enumType } from "nexus";

export const OutletType = enumType({
  name: "OutletType",
  members: ["retail", "wholesale", "service"],
});

export const Outlet = objectType({
  name: "Outlet",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("address");
    t.nonNull.string("code");
    t.nullable.int("nextTransactionNumber");
    t.nullable.float("governmentTax");
    t.nullable.float("serviceCharge");
    t.nonNull.field("outletType", { type: "OutletType" });
    t.nonNull.string("createdAt");
    t.nullable.string("wifiSSID");
    t.nonNull.boolean("isActive");
    t.nonNull.int("ownerId");
    t.nonNull.field("owner", {
      type: "User",
      resolve: (parent, args, ctx) => {
        return ctx.prisma.outlet
          .findUnique({ where: { id: parent.id } })
          .owner();
      },
    });
    t.nonNull.int("branchId");
    t.nonNull.field("branch", {
      type: "Branch",
      resolve: (parent, args, ctx) => {
        return ctx.prisma.outlet
          .findUnique({ where: { id: parent.id } })
          .branch();
      },
    });
    t.nonNull.list.nonNull.field("staff", {
      type: "OutletStaff",
      resolve: (parent, args, ctx) => {
        return ctx.prisma.outlet
          .findUnique({ where: { id: parent.id } })
          .staff();
      },
    });
    t.nullable.field("inventory", {
      type: "Inventory",
      resolve: (parent, args, ctx) => {
        return ctx.prisma.outlet
          .findUnique({ where: { id: parent.id } })
          .inventory();
      },
    });
    t.nonNull.list.nonNull.field("transaction", {
      type: "Transaction",
      resolve: (parent, args, ctx) => {
        return ctx.prisma.outlet
          .findUnique({ where: { id: parent.id } })
          .transaction();
      },
    });
  },
});
