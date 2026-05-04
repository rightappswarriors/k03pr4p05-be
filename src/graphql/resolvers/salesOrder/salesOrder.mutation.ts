// salesOrder.mutation.ts
import { extendType, intArg, stringArg, floatArg, inputObjectType, nonNull, list, arg, nullable } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';

export const SalesOrderItemInput = inputObjectType({
  name: "SalesOrderItemInput",
  definition(t) {
    t.nonNull.int("itemId");
    t.nonNull.float("quantity");
    t.nonNull.float("unitPrice");
    t.nullable.int("unitId");
    t.nullable.string("unitName");
  },
});
 
export const DeliveryInput = inputObjectType({
  name: "DeliveryInput",
  definition(t) {
    t.nonNull.string("address");
    t.nullable.string("courierName");
    t.nullable.string("trackingNumber");
    t.nullable.string("contactPerson");
    t.nullable.string("contactNumber");
    t.nullable.string("notes");
    t.nullable.string("estimatedDate");
  },
});
 

// ─── Helper: generate order number ────────────────────────────────────────────
 
async function generateOrderNumber(prisma: any, orgId: number): Promise<string> {
  const count = await prisma.salesOrder.count({ where: { orgId } });
  const pad = String(count + 1).padStart(5, "0");
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `SO-${yy}${mm}-${pad}`;
}
 


export const SalesOrderMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Create a new sales order (status: ORDERED)
    t.field("createSalesOrder", {
      type: "SalesOrder",
      args: {
        customer: nonNull(stringArg()),
        outletId: nonNull(intArg()),
        branchId: nonNull(intArg()),
        items: nonNull(list(nonNull(arg({ type: "SalesOrderItemInput" })))),
        subtotal: nonNull(floatArg()),
        discountAmount: nonNull(floatArg()),
        discountRate: nonNull(floatArg()),
        vatAmount: nonNull(floatArg()),
        vatRate: nonNull(floatArg()),
        total: nonNull(floatArg()),
        outletPromoId: nullable(intArg()),
      },
      resolve: async (_, args, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
 
        const orderNumber = await generateOrderNumber(ctx.prisma, orgId);
 
        const salesOrder = await ctx.prisma.salesOrder.create({
          data: {
            orderNumber,
            customer: args.customer,
            status: "ORDERED",
            orgId,
            userId,
            outletId: args.outletId,
            branchId: args.branchId,
            subtotal: args.subtotal,
            discountAmount: args.discountAmount,
            discountRate: args.discountRate,
            vatAmount: args.vatAmount,
            vatRate: args.vatRate,
            total: args.total,
            outletPromoId: args.outletPromoId ?? null,
            items: {
              create: args.items.map((item: any) => ({
                itemId: item.itemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                unitId: item.unitId ?? null,
                unitName: item.unitName ?? null,
              })),
            },
          },
          include: { items: true, delivery: true, outlet: true, branch: true },
        });
 
        // Audit log
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId,
            pageKey: "sales",
            action: "CREATE",
            recordId: salesOrder.id,
            recordType: "SalesOrder",
            newValue: {
              orderNumber,
              customer: args.customer,
              outletId: args.outletId,
              total: args.total,
              status: "ORDERED",
            },
          },
        });
 
        return salesOrder;
      },
    });
 
    // Move ORDERED → PROCESSING
    t.field("processSalesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
 
        const existing = await ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          select: { id: true, status: true, orderNumber: true },
        });
        if (!existing) throw new Error("Sales order not found");
        if (existing.status !== "ORDERED")
          throw new Error(`Cannot process an order with status: ${existing.status}`);
 
        const updated = await ctx.prisma.salesOrder.update({
          where: { id },
          data: { status: "PROCESSING" },
          include: { items: true, delivery: true, outlet: true, branch: true },
        });
 
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId,
            pageKey: "sales",
            action: "STATUS_CHANGE" as any,
            recordId: id,
            recordType: "SalesOrder",
            oldValue: { status: "ORDERED" },
            newValue: { status: "PROCESSING" },
          },
        });
 
        return updated;
      },
    });
 
    // Move PROCESSING → SHIPPED (requires delivery details)
    t.field("shipSalesOrder", {
      type: "SalesOrder",
      args: {
        id: nonNull(stringArg()),
        delivery: nonNull(arg({ type: "DeliveryInput" })),
      },
      resolve: async (_, { id, delivery }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
 
        const existing = await ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          select: { id: true, status: true },
        });
        if (!existing) throw new Error("Sales order not found");
        if (existing.status !== "PROCESSING")
          throw new Error(`Cannot ship an order with status: ${existing.status}`);
 
        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          // Upsert delivery record
          await tx.salesOrderDelivery.upsert({
            where: { salesOrderId: id },
            create: {
              salesOrderId: id,
              address: delivery.address,
              courierName: delivery.courierName ?? null,
              trackingNumber: delivery.trackingNumber ?? null,
              contactPerson: delivery.contactPerson ?? null,
              contactNumber: delivery.contactNumber ?? null,
              notes: delivery.notes ?? null,
              estimatedDate: delivery.estimatedDate
                ? new Date(delivery.estimatedDate)
                : null,
              shippedAt: new Date(),
            },
            update: {
              address: delivery.address,
              courierName: delivery.courierName ?? null,
              trackingNumber: delivery.trackingNumber ?? null,
              contactPerson: delivery.contactPerson ?? null,
              contactNumber: delivery.contactNumber ?? null,
              notes: delivery.notes ?? null,
              estimatedDate: delivery.estimatedDate
                ? new Date(delivery.estimatedDate)
                : null,
              shippedAt: new Date(),
            },
          });
 
          return tx.salesOrder.update({
            where: { id },
            data: { status: "SHIPPED" },
            include: { items: true, delivery: true, outlet: true, branch: true },
          });
        });
 
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId,
            pageKey: "sales",
            action: "STATUS_CHANGE" as any,
            recordId: id,
            recordType: "SalesOrder",
            oldValue: { status: "PROCESSING" },
            newValue: {
              status: "SHIPPED",
              delivery: {
                address: delivery.address,
                courierName: delivery.courierName,
                trackingNumber: delivery.trackingNumber,
              },
            },
          },
        });
 
        return updated;
      },
    });
 
    // Mark SHIPPED → RECEIVED
    t.field("receiveSalesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
 
        const existing = await ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          select: { id: true, status: true },
        });
        if (!existing) throw new Error("Sales order not found");
        if (existing.status !== "SHIPPED")
          throw new Error(`Cannot receive an order with status: ${existing.status}`);
 
        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          await tx.salesOrderDelivery.update({
            where: { salesOrderId: id },
            data: { receivedAt: new Date() },
          });
          return tx.salesOrder.update({
            where: { id },
            data: { status: "RECEIVED" },
            include: { items: true, delivery: true, outlet: true, branch: true },
          });
        });
 
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId,
            pageKey: "sales",
            action: "STATUS_CHANGE" as any,
            recordId: id,
            recordType: "SalesOrder",
            oldValue: { status: "SHIPPED" },
            newValue: { status: "RECEIVED" },
          },
        });
 
        return updated;
      },
    });
 
    // Cancel a sales order (ORDERED or PROCESSING only)
    t.field("cancelSalesOrder", {
      type: "SalesOrder",
      args: {
        id: nonNull(stringArg()),
        reason: nullable(stringArg()),
      },
      resolve: async (_, { id, reason }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
 
        const existing = await ctx.prisma.salesOrder.findFirst({
          where: { id, orgId },
          select: { id: true, status: true },
        });
        if (!existing) throw new Error("Sales order not found");
        if (["SHIPPED", "RECEIVED", "CANCELLED"].includes(existing.status))
          throw new Error(`Cannot cancel an order with status: ${existing.status}`);
 
        const updated = await ctx.prisma.salesOrder.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: { items: true, delivery: true, outlet: true, branch: true },
        });
 
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId,
            pageKey: "sales",
            action: "STATUS_CHANGE" as any,
            recordId: id,
            recordType: "SalesOrder",
            oldValue: { status: existing.status },
            newValue: { status: "CANCELLED", reason: reason ?? null },
          },
        });
 
        return updated;
      },
    });
  },
});