// salesOrder.mutation.ts
import {
  arg,
  extendType,
  floatArg,
  inputObjectType,
  intArg,
  list,
  nonNull,
  nullable,
  stringArg,
} from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { computeScPwdBreakdown } from '../../../services/transaction.service.js';

export const SalesOrderItemInput = inputObjectType({
  name: "SalesOrderItemInput",
  definition(t) {
    t.nullable.int("itemId");
    t.nonNull.float("quantity");
    t.nonNull.float("unitPrice");
    t.nullable.int("unitId");
    t.nullable.string("unitName");
    t.nullable.float("discountQuantity");
    t.nullable.float("discountRate");
    t.nullable.float("discountAmount");
    t.nullable.boolean("isCustomItem");
    t.nullable.string("customItemName");
    t.nullable.boolean("vatExempt");
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

const salesOrderInclude = {
  items: { include: { item: true } },
  delivery: true,
  outlet: true,
  branch: true,
  scPwdCustomer: true,
  extraCharges: true,
};

async function generateOrderNumber(prisma: any, orgId: number): Promise<string> {
  const count = await prisma.salesOrder.count({ where: { orgId } });
  const pad = String(count + 1).padStart(5, "0");
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `SO-${yy}${mm}-${pad}`;
}

function sanitizeExtraCharges(extraCharges?: any[] | null) {
  return (extraCharges ?? []).map((charge) => {
    const label = String(charge.label ?? "").trim();
    const amount = Number(charge.amount ?? 0);
    if (!label) throw new Error("Extra charge label is required.");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Extra charge amount must be greater than 0.");
    }
    return { label, amount };
  });
}

function initialStatusFor(orderMode: string) {
  return orderMode === "WALK_IN" ? "PROCESSING" : "PENDING";
}

function nextStatusFor(orderMode: string, status: string) {
  const flow: Record<string, string[]> = {
    WALK_IN: ["PROCESSING", "COMPLETED"],
    PICK_UP: ["PENDING", "PROCESSING", "READY_FOR_PICKUP", "COMPLETED"],
    DELIVERY: ["PENDING", "PROCESSING", "OUT_FOR_DELIVERY", "COMPLETED"],
  };
  const steps = flow[orderMode] ?? flow.WALK_IN;
  const index = steps.indexOf(status);
  return index >= 0 ? steps[index + 1] : undefined;
}

function labelOrderMode(orderMode: string) {
  if (orderMode === "PICK_UP") return "Pick-up";
  if (orderMode === "DELIVERY") return "Delivery";
  return "Walk-in";
}

async function updateStatus(ctx: any, id: string, status: string) {
  const orgId = Number(ctx.user.orgId);
  const userId = Number(ctx.user.userId);
  const existing = await ctx.prisma.salesOrder.findFirst({
    where: { id, orgId },
    select: { id: true, orderMode: true, status: true, orderNumber: true },
  });

  if (!existing) throw new Error("Sales order not found");
  if (existing.status === "COMPLETED") {
    throw new Error("Completed orders cannot be changed.");
  }
  if (existing.status === "CANCELLED") {
    throw new Error("Cancelled orders cannot be changed.");
  }

  if (status === "CANCELLED") {
    const updated = await ctx.prisma.salesOrder.update({
      where: { id },
      data: { status },
      include: salesOrderInclude,
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
        newValue: { status },
      },
    });
    return updated;
  }

  const next = nextStatusFor(existing.orderMode, existing.status);
  if (status !== next) {
    const modeLabel = labelOrderMode(existing.orderMode);
    const nextText = next ? ` Next valid status is ${next}.` : "";
    throw new Error(`Cannot move a ${modeLabel} order from ${existing.status} directly to ${status}.${nextText}`);
  }

  const updated = await ctx.prisma.salesOrder.update({
    where: { id },
    data: { status },
    include: salesOrderInclude,
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
      newValue: { status },
    },
  });

  return updated;
}

async function recalculateExtraTotals(tx: any, salesOrderId: string) {
  const order = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: { subtotal: true, discountAmount: true },
  });
  if (!order) throw new Error("Sales order not found");
  const charges = await tx.extraCharge.findMany({ where: { salesOrderId } });
  const extraChargesTotal = charges.reduce((sum: number, charge: any) => sum + Number(charge.amount ?? 0), 0);
  const grandTotal = Number(order.subtotal ?? 0) - Number(order.discountAmount ?? 0) + extraChargesTotal;
  return tx.salesOrder.update({
    where: { id: salesOrderId },
    data: { extraChargesTotal, grandTotal, total: grandTotal },
    include: salesOrderInclude,
  });
}

export const SalesOrderMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("createSalesOrder", {
      type: "SalesOrder",
      args: {
        customer: nullable(stringArg()),
        customerName: nullable(stringArg()),
        customerContact: nullable(stringArg()),
        orderMode: nonNull(arg({ type: "OrderModeEnum" })),
        outletId: nullable(intArg()),
        branchId: nullable(intArg()),
        items: nonNull(list(nonNull(arg({ type: "SalesOrderItemInput" })))),
        customerType: nullable(arg({ type: "CustomerType" })),
        scPwdCustomerInput: nullable(arg({ type: "ScPwdCustomerInput" })),
        discountType: nullable(arg({ type: "DiscountType" })),
        totalPax: nullable(intArg()),
        scPwdPax: nullable(intArg()),
        extraCharges: nullable(list(nonNull(arg({ type: "ExtraChargeInput" })))),
        deliveryAddress: nullable(stringArg()),
        deliveryNotes: nullable(stringArg()),
        subtotal: nullable(floatArg()),
        discountAmount: nullable(floatArg()),
        discountRate: nullable(floatArg()),
        vatAmount: nullable(floatArg()),
        vatRate: nullable(floatArg()),
        total: nullable(floatArg()),
        outletPromoId: nullable(intArg()),
      },
      resolve: async (_, args, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);

        const orgId = Number(ctx.user.orgId);
        const userId = Number(ctx.user.userId);
        const orderMode = args.orderMode;
        const customerType = args.customerType ?? "REGULAR";
        const discountType = args.discountType ?? "NONE";

        if (orderMode === "DELIVERY" && !args.deliveryAddress?.trim()) {
          throw new Error("Delivery address is required for delivery orders.");
        }
        if ((customerType === "SENIOR_CITIZEN" || customerType === "PWD") &&
          (!args.scPwdCustomerInput?.fullName?.trim() || !args.scPwdCustomerInput?.idNumber?.trim())) {
          throw new Error("SC/PWD customer full name and ID number are required.");
        }

        for (const item of args.items) {
          if (item.isCustomItem && !item.customItemName?.trim()) {
            throw new Error("Custom items must have a name.");
          }
          if (!item.isCustomItem && item.itemId == null) {
            throw new Error("Non-custom items must have an itemId.");
          }
        }

        const extraCharges = sanitizeExtraCharges(args.extraCharges);
        const subtotal = Number(
          args.items.reduce((sum: number, item: any) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0).toFixed(2),
        );

        const orderNumber = await generateOrderNumber(ctx.prisma, orgId);

        const salesOrder = await ctx.prisma.$transaction(async (tx: any) => {
          const breakdown = await computeScPwdBreakdown(
            tx,
            {
              discountType,
              discountRate: args.discountRate ?? 0,
              totalPax: args.totalPax,
              scPwdPax: args.scPwdPax,
              vatAmount: args.vatAmount ?? 0,
              total: subtotal,
            },
            args.items.map((item: any) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              price: item.unitPrice,
              priceAtSale: item.unitPrice,
              isCustomItem: item.isCustomItem ?? false,
              vatExempt: item.vatExempt ?? false,
            })),
          );

          const extraChargesTotal = Number(extraCharges.reduce((sum, charge) => sum + charge.amount, 0).toFixed(2));
          const total = Number(breakdown.netTotal.toFixed(2));
          const grandTotal = Number((total + extraChargesTotal).toFixed(2));

          let scPwdCustomerId: string | null = null;
          if (args.scPwdCustomerInput && customerType !== "REGULAR") {
            const customerData = {
              orgId,
              fullName: args.scPwdCustomerInput.fullName,
              idNumber: args.scPwdCustomerInput.idNumber,
              idType: args.scPwdCustomerInput.idType ?? (customerType === "PWD" ? "PWD-PDAO" : "OSCA"),
              customerType,
              dateOfBirth: args.scPwdCustomerInput.dateOfBirth
                ? new Date(args.scPwdCustomerInput.dateOfBirth)
                : null,
              contactNumber: args.scPwdCustomerInput.contactNumber ?? null,
              address: args.scPwdCustomerInput.address ?? null,
              isRepresentative: args.scPwdCustomerInput.isRepresentative ?? false,
              representativeName: args.scPwdCustomerInput.representativeName ?? null,
              representativeIdNumber: args.scPwdCustomerInput.representativeIdNumber ?? null,
            };
            const customer = args.scPwdCustomerInput.id
              ? await tx.scPwdCustomer.update({ where: { id: args.scPwdCustomerInput.id }, data: customerData })
              : await tx.scPwdCustomer.create({ data: customerData });
            scPwdCustomerId = customer.id;
          }

          return tx.salesOrder.create({
            data: {
              orderNumber,
              customer: args.customerName?.trim() || args.customer?.trim() || "Walk-in Customer",
              customerName: args.customerName?.trim() || null,
              customerContact: args.customerContact?.trim() || null,
              orderMode,
              status: initialStatusFor(orderMode),
              orgId,
              userId,
              outletId: args.outletId ?? null,
              branchId: args.branchId ?? null,
              customerType,
              discountType,
              discountRate: breakdown.discountRate,
              discountAmount: breakdown.discountAmount,
              vatAmount: breakdown.vatAmount,
              vatExemptSale: breakdown.vatExemptSale,
              totalPax: args.totalPax ?? null,
              scPwdPax: args.scPwdPax ?? null,
              scPwdCustomerId,
              deliveryAddress: args.deliveryAddress?.trim() || null,
              deliveryNotes: args.deliveryNotes?.trim() || null,
              subtotal,
              total,
              vatRate: args.vatRate ?? 0.12,
              extraChargesTotal,
              grandTotal,
              outletPromoId: args.outletPromoId ?? null,
              items: {
                create: args.items.map((item: any) => ({
                  itemId: item.isCustomItem ? null : item.itemId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: Number((item.quantity * item.unitPrice).toFixed(2)),
                  unitId: item.unitId ?? null,
                  unitName: item.unitName ?? null,
                  discountQuantity: item.discountQuantity ?? 0,
                  discountRate: item.discountRate ?? 0,
                  discountAmount: item.discountAmount ?? 0,
                  isCustomItem: item.isCustomItem ?? false,
                  customItemName: item.isCustomItem ? item.customItemName?.trim() ?? null : null,
                  vatExempt: item.vatExempt ?? false,
                })),
              },
              extraCharges: {
                create: extraCharges,
              },
            },
            include: salesOrderInclude,
          });
        });

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
              orderMode,
              status: salesOrder.status,
              grandTotal: salesOrder.grandTotal,
            },
          },
        });

        return salesOrder;
      },
    });

    t.field("updateSalesOrder", {
      type: "SalesOrder",
      args: {
        id: nonNull(stringArg()),
        customerName: nullable(stringArg()),
        customerContact: nullable(stringArg()),
        deliveryAddress: nullable(stringArg()),
        deliveryNotes: nullable(stringArg()),
        orderMode: nullable(arg({ type: "OrderModeEnum" })),
      },
      resolve: async (_, args, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const existing = await ctx.prisma.salesOrder.findFirst({ where: { id: args.id, orgId } });
        if (!existing) throw new Error("Sales order not found");
        if (args.orderMode === "DELIVERY" && !args.deliveryAddress?.trim() && !existing.deliveryAddress) {
          throw new Error("Delivery address is required for delivery orders.");
        }
        return ctx.prisma.salesOrder.update({
          where: { id: args.id },
          data: {
            customerName: args.customerName ?? undefined,
            customer: args.customerName ?? undefined,
            customerContact: args.customerContact ?? undefined,
            deliveryAddress: args.deliveryAddress ?? undefined,
            deliveryNotes: args.deliveryNotes ?? undefined,
            orderMode: args.orderMode ?? undefined,
          },
          include: salesOrderInclude,
        });
      },
    });

    t.field("updateSalesOrderStatus", {
      type: "SalesOrder",
      args: {
        salesOrderId: nonNull(stringArg()),
        status: nonNull(arg({ type: "SalesOrderStatusEnum" })),
      },
      resolve: async (_, { salesOrderId, status }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        return updateStatus(ctx, salesOrderId, status);
      },
    });

    t.field("addExtraCharge", {
      type: "SalesOrder",
      args: {
        salesOrderId: nonNull(stringArg()),
        label: nonNull(stringArg()),
        amount: nonNull(floatArg()),
      },
      resolve: async (_, { salesOrderId, label, amount }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const order = await ctx.prisma.salesOrder.findFirst({ where: { id: salesOrderId, orgId } });
        if (!order) throw new Error("Sales order not found");
        const [charge] = sanitizeExtraCharges([{ label, amount }]);
        return ctx.prisma.$transaction(async (tx: any) => {
          await tx.extraCharge.create({ data: { salesOrderId, ...charge } });
          return recalculateExtraTotals(tx, salesOrderId);
        });
      },
    });

    t.field("removeExtraCharge", {
      type: "SalesOrder",
      args: {
        extraChargeId: nonNull(stringArg()),
      },
      resolve: async (_, { extraChargeId }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        const orgId = Number(ctx.user.orgId);
        const charge = await ctx.prisma.extraCharge.findFirst({
          where: { id: extraChargeId, salesOrder: { orgId } },
          select: { id: true, salesOrderId: true },
        });
        if (!charge) throw new Error("Extra charge not found");
        return ctx.prisma.$transaction(async (tx: any) => {
          await tx.extraCharge.delete({ where: { id: extraChargeId } });
          return recalculateExtraTotals(tx, charge.salesOrderId);
        });
      },
    });

    t.field("processSalesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        return updateStatus(ctx, id, "PROCESSING");
      },
    });

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
        const order = await ctx.prisma.salesOrder.findFirst({ where: { id, orgId } });
        if (!order) throw new Error("Sales order not found");
        if (order.orderMode !== "DELIVERY") {
          throw new Error("Only delivery orders can be marked out for delivery.");
        }
        await ctx.prisma.salesOrderDelivery.upsert({
          where: { salesOrderId: id },
          create: {
            salesOrderId: id,
            address: delivery.address,
            courierName: delivery.courierName ?? null,
            trackingNumber: delivery.trackingNumber ?? null,
            contactPerson: delivery.contactPerson ?? null,
            contactNumber: delivery.contactNumber ?? null,
            notes: delivery.notes ?? null,
            estimatedDate: delivery.estimatedDate ? new Date(delivery.estimatedDate) : null,
            shippedAt: new Date(),
          },
          update: {
            address: delivery.address,
            courierName: delivery.courierName ?? null,
            trackingNumber: delivery.trackingNumber ?? null,
            contactPerson: delivery.contactPerson ?? null,
            contactNumber: delivery.contactNumber ?? null,
            notes: delivery.notes ?? null,
            estimatedDate: delivery.estimatedDate ? new Date(delivery.estimatedDate) : null,
            shippedAt: new Date(),
          },
        });
        return updateStatus(ctx, id, "OUT_FOR_DELIVERY");
      },
    });

    t.field("receiveSalesOrder", {
      type: "SalesOrder",
      args: { id: nonNull(stringArg()) },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        await ctx.prisma.salesOrderDelivery.updateMany({
          where: { salesOrderId: id },
          data: { receivedAt: new Date() },
        });
        return updateStatus(ctx, id, "COMPLETED");
      },
    });

    t.field("cancelSalesOrder", {
      type: "SalesOrder",
      args: {
        id: nonNull(stringArg()),
        reason: nullable(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER", "STAFF"]);
        return updateStatus(ctx, id, "CANCELLED");
      },
    });
  },
});
