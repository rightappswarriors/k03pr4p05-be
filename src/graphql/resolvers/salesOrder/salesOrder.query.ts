// salesOrder.query.ts
import { arg, extendType, intArg, nonNull, nullable, stringArg } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';

const salesOrderInclude = {
  items: { include: { item: true } },
  delivery: true,
  outlet: true,
  branch: true,
  scPwdCustomer: true,
  extraCharges: true,
};

function buildSalesOrderWhere(orgId: number, args: any) {
  const filter = args.filter ?? args;
  const where: any = { orgId };
  if (filter.status) where.status = filter.status;
  if (filter.orderMode) where.orderMode = filter.orderMode;
  if (filter.discountType) where.discountType = filter.discountType;
  if (args.outletId) where.outletId = args.outletId;
  if (args.branchId) where.branchId = args.branchId;
  if (filter.customerName?.trim()) {
    where.OR = [
      { customerName: { contains: filter.customerName.trim(), mode: "insensitive" } },
      { customer: { contains: filter.customerName.trim(), mode: "insensitive" } },
    ];
  }
  if (filter.startDate || filter.endDate) {
    where.date = {
      ...(filter.startDate && { gte: new Date(filter.startDate) }),
      ...(filter.endDate && { lte: new Date(filter.endDate) }),
    };
  }
  return where;
}

export const SalesOrderQuery = extendType({
  type: "Query",
  definition(t) {

    // ── Get all sales orders for the org ─────────────────────────────────────
    t.list.field("getSalesOrders", {
      type: "SalesOrder",
      args: {
        filter: nullable(arg({ type: "SalesOrderFilterInput" })),
        status: nullable(arg({ type: "SalesOrderStatusEnum" })),
        orderMode: nullable(arg({ type: "OrderModeEnum" })),
        discountType: nullable(arg({ type: "DiscountType" })),
        outletId: nullable(intArg()),
        branchId: nullable(intArg()),
        startDate: nullable(stringArg()),
        endDate: nullable(stringArg()),
        customerName: nullable(stringArg()),
      },
      resolve: async (_, args, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);

        return ctx.prisma.salesOrder.findMany({
          where: buildSalesOrderWhere(orgId, args),
          orderBy: { date: "desc" },
          include: salesOrderInclude,
        });
      },
    });

    t.list.field("salesOrders", {
      type: "SalesOrder",
      args: {
        filter: nullable(arg({ type: "SalesOrderFilterInput" })),
      },
      resolve: async (_, args, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.salesOrder.findMany({
          where: buildSalesOrderWhere(orgId, args),
          orderBy: { date: "desc" },
          include: salesOrderInclude,
        });
      },
    });

    t.list.field("salesOrdersByStatus", {
      type: "SalesOrder",
      args: { status: nonNull(arg({ type: "SalesOrderStatusEnum" })) },
      resolve: async (_, { status }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.salesOrder.findMany({
          where: { orgId, status },
          orderBy: { date: "desc" },
          include: salesOrderInclude,
        });
      },
    });

    t.list.field("salesOrdersByMode", {
      type: "SalesOrder",
      args: { orderMode: nonNull(arg({ type: "OrderModeEnum" })) },
      resolve: async (_, { orderMode }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.salesOrder.findMany({
          where: { orgId, orderMode },
          orderBy: { date: "desc" },
          include: salesOrderInclude,
        });
      },
    });

    // ── Get single sales order ────────────────────────────────────────────────
    t.nullable.field("getSalesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          include: salesOrderInclude,
        });
      },
    });

    t.nullable.field("salesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          include: salesOrderInclude,
        });
      },
    });

    // ── Get branches for org (cascading branch → outlet picker) ──────────────
    t.list.field("getBranchesForSales", {
      type: "Branch",
      resolve: async (_, __, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.branch.findMany({
          where: { orgId, isActive: true },
          orderBy: { name: "asc" },
        });
      },
    });

    // ── Get outlets filtered by branch (cascading picker) ─────────────────────
    t.list.field("getOutletsByBranch", {
      type: "Outlet",
      args: { branchId: nonNull(intArg()) },
      resolve: async (_, { branchId }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.outlet.findMany({
          where: { orgId, branchId },
          orderBy: { name: "asc" },
          include: {
            outletPromos: {
              where: { isActive: true },
              include: { promoType: true },
            },
            vatType: true,
          },
        });
      },
    });

    // ── Get VAT types for org ─────────────────────────────────────────────────
    t.list.field("getOrgVatTypes", {
      type: "VatType",
      resolve: async (_, __, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        return ctx.prisma.vatType.findMany({ where: { orgId } });
      },
    });

    // ── Get inventory items for product picker ────────────────────────────────
    //
    // outletId is NULLABLE:
    //   • Provided  → items for that outlet only (original behaviour)
    //   • Omitted / null → ALL org items, each tagged with its outlet name
    //     (enables the "no outlet selected → show everything" UX in AddOrderModal)
    //
    // IMPORTANT: the arg type stays nullable(intArg()) — do NOT add nonNull()
    // here or the frontend will break when passing null.
    t.list.field("getOutletInventoryItems", {
      type: "InventoryItems",
      args: {
        outletId: nullable(intArg()),   // ← nullable — null means "all org items"
        branchId: nullable(intArg()),
      },
      resolve: async (_, { outletId, branchId }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);

        // ── Branch A: no outletId and no branchId → return every item across all org outlets ─
        if (outletId == null && branchId == null) {
          const allInventories: Array<{ id: number; outletId: number }> =
            await ctx.prisma.inventory.findMany({
              where: {
                outlet: {
                  orgId: orgId,
                },
              },
              select: { id: true, outletId: true },
            });

          const nested: Array<Promise<any>> = [];
          for (let idx = 0; idx < allInventories.length; idx += 1) {
            const inv: { id: number; outletId: number } = allInventories[idx];
            nested.push(
              ctx.prisma.inventoryItems.findMany({
                where: { inventoryId: inv.id, quantity: { gt: 0 } },
                include: {
                  item: true,
                  units: true,
                  inventory: {
                    include: {
                      outlet: {
                        select: { id: true, name: true, code: true },
                      },
                    },
                  },
                },
              })
            );
          }

          const nestedItems = await Promise.all(nested);
          return nestedItems
            .flat()
            .sort((a, b) => a.item.name.localeCompare(b.item.name));
        }

        // ── Branch B: branchId provided, but no outlet selected ─────────────
        if (outletId == null && branchId != null) {
          const branchInventories = await ctx.prisma.inventory.findMany({
            where: {
              outlet: {
                orgId,
                branchId: Number(branchId),
              },
            },
            select: { id: true },
          });

          const nested: Array<Promise<any>> = branchInventories.map((inv: { id: number }) =>
            ctx.prisma.inventoryItems.findMany({
              where: { inventoryId: inv.id, quantity: { gt: 0 } },
              include: {
                item: true,
                units: true,
                inventory: {
                  include: {
                    outlet: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
            }),
          );

          const nestedItems = await Promise.all(nested);
          return nestedItems
            .flat()
            .sort((a, b) => a.item.name.localeCompare(b.item.name));
        }

        // ── Branch C: outletId provided → scope to that outlet only ──────────
        return ctx.prisma.inventoryItems.findMany({
          where: {
            quantity: { gt: 0 },
            inventory: { outletId: Number(outletId) },
          },
          include: {
            item: true,
            units: true,
            inventory: {
              include: {
                outlet: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
          orderBy: { item: { name: "asc" } },
        });
      },
    });

    // ── Search inventory items with pagination ───────────────────────────────
    t.nonNull.field("searchInventoryItems", {
      type: "InventoryItemsSearchResult",
      args: {
        outletId: nullable(intArg()),
        branchId: nullable(intArg()),
        search: nullable(stringArg()),
        skip: nonNull(intArg()),
        take: nonNull(intArg()),
      },
      resolve: async (_, { outletId, branchId, search, skip, take }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);

        const where: any = {
          quantity: { gt: 0 },
        };

        if (outletId != null) {
          where.inventory = { outletId: Number(outletId) };
        } else if (branchId != null) {
          where.inventory = { outlet: { orgId, branchId: Number(branchId) } };
        } else {
          where.inventory = {
            outlet: { orgId },
          };
        }

        if (search && search.trim()) {
          where.item = {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          };
        }

        const inventoryItems = await ctx.prisma.inventoryItems.findMany({
          where,
          include: {
            item: true,
            units: {
              where: { isActive: true },
              orderBy: [{ isDefault: "desc" }, { price: "asc" }],
            },
            inventory: {
              include: {
                outlet: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { item: { name: "asc" } },
        });

        let items = inventoryItems;

        if (outletId == null && branchId == null) {
          const inventoryItemIds = inventoryItems
            .map((entry: any) => Number(entry.itemId))
            .filter((itemId: number) => Number.isFinite(itemId));

          const orphanItems = await ctx.prisma.item.findMany({
            where: {
              orgId,
              id: { notIn: inventoryItemIds },
              ...(search?.trim()
                ? {
                    name: {
                      contains: search.trim(),
                      mode: "insensitive",
                    },
                  }
                : {}),
            },
            orderBy: { name: "asc" },
          });

          const syntheticItems = orphanItems.map((item: any) => ({
            id: -Number(item.id),
            inventoryId: 0,
            itemId: item.id,
            quantity: Number(item.stock ?? 0),
            locationId: null,
            categoryId: item.categoryId ?? null,
            price: Number(item.sellingPrice ?? 0),
            baseUnit: "piece",
            item,
            units: [],
            inventory: { id: 0, outletId: 0, name: "Organization Items", outlet: null },
          }));

          items = [...inventoryItems, ...syntheticItems].sort((a: any, b: any) =>
            a.item.name.localeCompare(b.item.name),
          );
        }

        const totalCount = items.length;
        items = items.slice(skip, skip + take);
        const hasMore = skip + items.length < totalCount;

        return { items, hasMore };
      },
    });
  },
});
