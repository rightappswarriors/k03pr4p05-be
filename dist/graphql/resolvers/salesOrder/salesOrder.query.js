// salesOrder.query.ts
import { arg, extendType, intArg, nonNull, nullable, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const SalesOrderQuery = extendType({
    type: "Query",
    definition(t) {
        // ── Get all sales orders for the org ─────────────────────────────────────
        t.list.field("getSalesOrders", {
            type: "SalesOrder",
            args: {
                status: nullable(arg({ type: "SalesOrderStatusEnum" })),
                outletId: nullable(intArg()),
                branchId: nullable(intArg()),
                startDate: nullable(stringArg()),
                endDate: nullable(stringArg()),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
                const orgId = Number(ctx.user.orgId);
                const where = { orgId };
                if (args.status)
                    where.status = args.status;
                if (args.outletId)
                    where.outletId = args.outletId;
                if (args.branchId)
                    where.branchId = args.branchId;
                if (args.startDate || args.endDate) {
                    where.date = {
                        ...(args.startDate && { gte: new Date(args.startDate) }),
                        ...(args.endDate && { lte: new Date(args.endDate) }),
                    };
                }
                return ctx.prisma.salesOrder.findMany({
                    where,
                    orderBy: { date: "desc" },
                    include: { items: true, delivery: true, outlet: true, branch: true },
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
                    include: { items: true, delivery: true, outlet: true, branch: true },
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
                outletId: nullable(intArg()), // ← nullable — null means "all org items"
            },
            resolve: async (_, { outletId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
                const orgId = Number(ctx.user.orgId);
                // ── Branch A: no outletId → return every item across all org outlets ─
                if (outletId == null) {
                    // 1. Find all inventories belonging to this org via outlet relationship
                    const allInventories = await ctx.prisma.inventory.findMany({
                        where: {
                            outlet: {
                                orgId: orgId,
                            },
                        },
                        select: { id: true, outletId: true },
                    });
                    // 2. Fetch items for each inventory in parallel
                    const nested = [];
                    for (let idx = 0; idx < allInventories.length; idx += 1) {
                        const inv = allInventories[idx];
                        nested.push(ctx.prisma.inventoryItems.findMany({
                            where: { inventoryId: inv.id, quantity: { gt: 0 } },
                            include: {
                                item: true, // includes item.vatExempt (Boolean? on Item model)
                                units: true,
                                // ── FIX: include inventory → outlet so the frontend can
                                //    render the outlet name tag on each product card ────────
                                inventory: {
                                    include: {
                                        outlet: {
                                            select: { id: true, name: true, code: true },
                                        },
                                    },
                                },
                            },
                        }));
                    }
                    const nestedItems = await Promise.all(nested);
                    // 3. Flatten and sort alphabetically by item name
                    return nestedItems
                        .flat()
                        .sort((a, b) => a.item.name.localeCompare(b.item.name));
                }
                // ── Branch B: outletId provided → scope to that outlet only ──────────
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
                search: nullable(stringArg()),
                skip: nonNull(intArg()),
                take: nonNull(intArg()),
            },
            resolve: async (_, { outletId, search, skip, take }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
                const orgId = Number(ctx.user.orgId);
                const where = {
                    quantity: { gt: 0 },
                };
                // If outletId is provided, scope to that outlet's inventory
                if (outletId != null) {
                    where.inventory = { outletId: Number(outletId) };
                }
                else {
                    // No outletId — search across all org inventories for the org
                    where.inventory = {
                        outlet: { orgId },
                    };
                }
                // Add search filter if provided
                if (search && search.trim()) {
                    where.item = {
                        name: {
                            contains: search.trim(),
                            mode: 'insensitive',
                        },
                    };
                }
                // Get total count for hasMore calculation
                const totalCount = await ctx.prisma.inventoryItems.count({ where });
                // Get paginated items
                const items = await ctx.prisma.inventoryItems.findMany({
                    where,
                    skip,
                    take,
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
                const hasMore = skip + items.length < totalCount;
                return { items, hasMore };
            },
        });
    },
});
