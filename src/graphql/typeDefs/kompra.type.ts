// graphql/kompra/types.ts
// Nexus type definitions for all new Kompra models
// Run after adding to your existing Nexus schema

import { objectType, enumType, inputObjectType, extendType, nonNull, nullable, list, arg, intArg, stringArg, floatArg } from 'nexus'
import { computeScPwdBreakdown, getWeeklyBnpcState } from '../../services/transaction.service.js'

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const OrderStatusEnum = enumType({
  name: 'OrderStatus',
  members: ['pending', 'confirmed', 'preparing', 'in_delivery', 'received', 'cancelled', 'returned'],
})

export const DeliveryStatusEventEnum = enumType({
  name: 'DeliveryStatusEvent',
  members: ['order_placed', 'outlet_confirmed', 'outlet_preparing', 'rider_assigned', 'rider_picked_up', 'rider_en_route', 'arrived_at_door', 'delivered', 'cancelled', 'return_requested', 'returned'],
})

export const FeeTypeEnum = enumType({
  name: 'FeeType',
  members: ['delivery', 'packaging', 'priority', 'handling', 'voucher_discount'],
})

export const KompraCPaymentMethodEnum = enumType({
  name: 'KompraCPaymentMethod',
  members: ['cash_on_delivery', 'gcash', 'paymaya', 'card', 'qrph'],
})

// ─── ITEM TAXONOMY ────────────────────────────────────────────────────────────

export const ItemGroupType = objectType({
  name: 'KompraItemGroup',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('name')
    t.nullable.string('description')
    t.nullable.string('icon')
    t.nonNull.boolean('isActive')
    t.nonNull.string('createdAt')
    t.nonNull.list.nonNull.field('categories', { type: 'ItemCategory' })
  },
})

export const ItemCategoryMapType = objectType({
  name: 'ItemCategoryMap',
  definition(t) {
    t.nonNull.int('itemId')
    t.nonNull.int('categoryId')
    t.nonNull.field('item', { type: 'Item' })
    t.nonNull.field('category', { type: 'ItemCategory' })
  },
})

// ─── EKUMPRA CUSTOMER ─────────────────────────────────────────────────────────

export const KompraCustomerType = objectType({
  name: 'KompraCustomer',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('fullname')
    t.nullable.string('email')
    t.nonNull.string('phone')
    t.nullable.string('profilePhoto')
    t.nonNull.boolean('isVerified')
    t.nonNull.boolean('isActive')
    t.nonNull.string('createdAt')
    t.nonNull.string('updatedAt')
    t.nonNull.list.nonNull.field('addresses', { type: 'DeliveryAddress' })
    t.nonNull.list.nonNull.field('orders', { type: 'KompraCOrder' })
  },
})

export const CustomerDeviceTokenType = objectType({
  name: 'CustomerDeviceToken',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('customerId')
    t.nonNull.string('token')
    t.nonNull.string('platform')
    t.nonNull.string('createdAt')
  },
})

export const DeliveryAddressType = objectType({
  name: 'DeliveryAddress',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('customerId')
    t.nonNull.string('label')
    t.nonNull.string('address')
    t.nonNull.float('latitude')
    t.nonNull.float('longitude')
    t.nonNull.boolean('isDefault')
    t.nonNull.string('createdAt')
    t.nonNull.field('customer', { type: 'KompraCustomer' })
  },
})

// ─── ORDER ────────────────────────────────────────────────────────────────────

export const KompraCOrderType = objectType({
  name: 'KompraCOrder',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('transactionNumber')
    t.nonNull.int('customerId')
    t.nonNull.int('outletId')
    t.nonNull.int('deliveryAddressId')
    t.nonNull.float('subtotal')
    t.nonNull.float('total')
    t.nonNull.field('status', { type: 'OrderStatus' })
    t.nullable.string('scheduledDeliveryAt')
    t.nullable.string('estimatedDeliveryAt')
    t.nullable.string('deliveredAt')
    t.nonNull.field('paymentMethod', { type: 'KompraCPaymentMethod' })
    t.nonNull.string('paymentStatus')
    t.nullable.string('paymentReference')
    t.nullable.string('riderName')
    t.nullable.string('riderPhone')
    t.nullable.string('customerNote')
    t.nullable.string('outletNote')
    t.nonNull.string('createdAt')
    t.nonNull.string('updatedAt')
    t.nonNull.field('customer', { type: 'KompraCustomer' })
    t.nonNull.field('outlet', { type: 'Outlet' })
    t.nonNull.field('deliveryAddress', { type: 'DeliveryAddress' })
    t.nonNull.list.nonNull.field('items', { type: 'KompraCOrderItem' })
    t.nonNull.list.nonNull.field('fees', { type: 'KompraCOrderFee' })
    t.nonNull.list.nonNull.field('tracking', { type: 'KompraCDeliveryTracking' })
  },
})

export const KompraCOrderSummaryType = objectType({
  name: 'KompraCOrderSummary',
  definition(t) {
    t.nonNull.field('status', { type: 'OrderStatus' })
    t.nonNull.float('total')
    t.nonNull.string('createdAt')
  },
})

export const KompraCOrderItemType = objectType({
  name: 'KompraCOrderItem',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('orderId')
    t.nonNull.int('inventoryItemId')
    t.nonNull.int('itemId')
    t.nonNull.int('quantity')
    t.nonNull.float('priceSnapshot')
    t.nonNull.float('subtotal')
    t.nonNull.field('item', { type: 'Item' })
    t.nonNull.field('inventoryItem', { type: 'InventoryItems' })
  },
})

export const KompraCOrderFeeType = objectType({
  name: 'KompraCOrderFee',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('orderId')
    t.nonNull.field('type', { type: 'FeeType' })
    t.nonNull.string('label')
    t.nonNull.float('amount')
  },
})

export const KompraCDeliveryTrackingType = objectType({
  name: 'KompraCDeliveryTracking',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('orderId')
    t.nonNull.field('event', { type: 'DeliveryStatusEvent' })
    t.nonNull.string('statusAt')
    t.nullable.float('currentLat')
    t.nullable.float('currentLng')
    t.nullable.string('note')
    t.nonNull.string('actorType')
    t.nullable.int('actorId')
  },
})

// ─── DELIVERY CONFIG ──────────────────────────────────────────────────────────

export const OutletDeliveryConfigType = objectType({
  name: 'OutletDeliveryConfig',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('outletId')
    t.nonNull.boolean('isDeliveryActive')
    t.nonNull.float('deliveryRadiusKm')
    t.nonNull.float('baseDeliveryFee')
    t.nonNull.float('feePerKm')
    t.nullable.float('minOrderAmount')
    t.nullable.float('maxOrderAmount')
    t.nonNull.int('avgPrepMins')
  },
})

// ─── SEARCH RESULT (not a DB model — a computed response type) ────────────────

export const OutletMatchedItemType = objectType({
  name: 'OutletMatchedItem',
  definition(t) {
    t.nonNull.int('itemId')
    t.nonNull.string('itemName')
    t.nonNull.float('price')
    t.nonNull.int('stockQty')
    t.nonNull.boolean('available')
  },
})

export const OutletMissingItemType = objectType({
  name: 'OutletMissingItem',
  definition(t) {
    t.nonNull.int('itemId')
    t.nonNull.string('itemName')
  },
})

export const OutletSearchResultType = objectType({
  name: 'OutletSearchResult',
  definition(t) {
    t.nonNull.int('outletId')
    t.nonNull.string('outletName')
    t.nonNull.string('outletAddress')
    t.nonNull.float('latitude')
    t.nonNull.float('longitude')
    t.nonNull.float('distanceKm')
    t.nonNull.float('deliveryFeeEstimate')
    t.nonNull.int('matchCount')
    t.nonNull.int('totalItems')
    t.nonNull.string('matchLabel')
    t.nonNull.float('matchScore')
    t.nonNull.list.nonNull.field('matchedItems', { type: 'OutletMatchedItem' })
    t.nonNull.list.nonNull.field('missingItems', { type: 'OutletMissingItem' })
  },
})

// ─── INPUT TYPES ──────────────────────────────────────────────────────────────

export const SearchItemInput = inputObjectType({
  name: 'SearchItemInput',
  definition(t) {
    t.nonNull.int('itemId')
    t.nonNull.string('name')
    t.nonNull.int('quantityWanted')
  },
})

export const OrderItemInput = inputObjectType({
  name: 'OrderItemInput',
  definition(t) {
    t.nonNull.int('inventoryItemId')
    t.nonNull.int('itemId')
    t.nonNull.int('quantity')
  },
})

export const PlaceOrderInput = inputObjectType({
  name: 'PlaceOrderInput',
  definition(t) {
    t.nonNull.int('outletId')
    t.nonNull.int('deliveryAddressId')
    t.nonNull.field('paymentMethod', { type: 'KompraCPaymentMethod' })
    t.nonNull.list.nonNull.field('items', { type: 'OrderItemInput' })
    t.nullable.field('discountType', { type: 'DiscountType' })
    t.nullable.int('totalPax')
    t.nullable.int('scPwdPax')
    t.nullable.string('customerNote')
    t.nullable.string('scheduledDeliveryAt')
  },
})

export const RegisterCustomerInput = inputObjectType({
  name: 'RegisterCustomerInput',
  definition(t) {
    t.nonNull.string('fullname')
    t.nonNull.string('phone')
    t.nullable.string('email')
    t.nonNull.string('password')
  },
})

export const AddDeliveryAddressInput = inputObjectType({
  name: 'AddDeliveryAddressInput',
  definition(t) {
    t.nonNull.string('label')
    t.nonNull.string('address')
    t.nonNull.float('latitude')
    t.nonNull.float('longitude')
    t.nonNull.boolean('isDefault')
  },
})

// ─── QUERIES ──────────────────────────────────────────────────────────────────

export const KompraCQuery = extendType({
  type: 'Query',
  definition(t) {

    // Find nearest outlets that have the requested items
    t.nonNull.list.nonNull.field('nearestOutletsWithItems', {
      type: 'OutletSearchResult',
      args: {
        customerLat: nonNull(floatArg()),
        customerLng: nonNull(floatArg()),
        items: nonNull(list(nonNull(arg({ type: 'SearchItemInput' })))),
        maxResults: nullable(intArg()),
      },
      resolve: async (_root, args, ctx) => {
        const { findNearestOutletsWithItems } = await import('../../lib/ekumpra/nearestOutletsSearch.js')
        return findNearestOutletsWithItems(
          args.customerLat,
          args.customerLng,
          args.items,
          args.maxResults ?? 10
        )
      },
    })

    // Get outlet catalog (all in-stock items grouped by category)
    t.nonNull.field('outletCatalog', {
      type: 'OutletCatalogResult',
      args: {
        outletId: nonNull(intArg()),
      },
      resolve: async (_root, { outletId }, ctx) => {
        const items = await ctx.prisma.inventoryItems.findMany({
          where: { inventory: { outletId }, quantity: { gt: 0 } },
          include: {
            item: {
              include: {
                categories: { include: { category: { include: { group: true } } } },
                brandDetails: true,
              },
            },
          },
        })
        return { outletId, items }
      },
    })

    // Get order with full tracking timeline
    t.nullable.field('kompraCOrder', {
      type: 'KompraCOrder',
      args: { id: nonNull(intArg()) },
      resolve: (_root, { id }, ctx) =>
        ctx.prisma.kompraCOrder.findUnique({
          where: { id },
          include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
        }),
    })

    // Customer's order history
    t.nonNull.list.nonNull.field('myOrders', {
      type: 'KompraCOrder',
      args: { customerId: nonNull(intArg()) },
      resolve: (_root, { customerId }, ctx) =>
        ctx.prisma.kompraCOrder.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
        }),
    })

    // Outlet's incoming order queue (for outlet dashboard)
    t.nonNull.list.nonNull.field('outletOrderQueue', {
      type: 'KompraCOrder',
      args: { outletId: nonNull(intArg()) },
      resolve: (_root, { outletId }, ctx) =>
        ctx.prisma.kompraCOrder.findMany({
          where: {
            outletId,
            status: { in: ['pending', 'confirmed', 'preparing'] },
          },
          orderBy: { createdAt: 'asc' },
          include: { items: { include: { item: true } }, fees: true, customer: true },
        }),
    })

    // Get KompraC orders for dashboard/analytics (filtered by organization)
    t.nonNull.list.nonNull.field('getKompraCOrdersSummary', {
      type: 'KompraCOrderSummary',
      args: {
        organizationId: nullable(intArg()),
        startDate: nullable(stringArg()),
        endDate: nullable(stringArg()),
        take: nullable(intArg()),
        skip: nullable(intArg()),
      },
      resolve: async (_root, args, ctx) => {
        const orgId = args.organizationId ?? Number(ctx.user?.orgId);

        const where: any = {
          outlet: { orgId },
        };

        if (args.startDate || args.endDate) {
          where.createdAt = {};
          if (args.startDate) where.createdAt.gte = new Date(args.startDate);
          if (args.endDate) where.createdAt.lte = new Date(args.endDate);
        }

        return ctx.prisma.kompraCOrder.findMany({
          where,
          take: args.take ?? undefined,
          skip: args.skip ?? undefined,
          orderBy: { createdAt: 'desc' },
          select: {
            total: true,
            status: true,
            createdAt: true,
          },
        });
      },
    })
  },
})

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const KompraCMutation = extendType({
  type: 'Mutation',
  definition(t) {

    // Register a new Kompra customer
    t.nonNull.field('registerKompraCustomer', {
      type: 'KompraCustomer',
      args: { input: nonNull(arg({ type: 'RegisterCustomerInput' })) },
      resolve: async (_root, { input }, ctx) => {
        const bcrypt = await import('bcrypt')
        const passwordHash = await bcrypt.hash(input.password, 10)
        return ctx.prisma.kompraCustomer.create({
          data: { fullname: input.fullname, phone: input.phone, email: input.email, passwordHash },
        })
      },
    })

    // Add a delivery address for a customer
    t.nonNull.field('addDeliveryAddress', {
      type: 'DeliveryAddress',
      args: {
        customerId: nonNull(intArg()),
        input: nonNull(arg({ type: 'AddDeliveryAddressInput' })),
      },
      resolve: async (_root, { customerId, input }, ctx) => {
        // If isDefault, unset all other defaults first
        if (input.isDefault) {
          await ctx.prisma.deliveryAddress.updateMany({
            where: { customerId },
            data: { isDefault: false },
          })
        }
        return ctx.prisma.deliveryAddress.create({ data: { customerId, ...input } })
      },
    })

    // Place an order — the main Kompra flow
    t.nonNull.field('placeKompraOrder', {
      type: 'KompraCOrder',
      args: {
        customerId: nonNull(intArg()),
        input: nonNull(arg({ type: 'PlaceOrderInput' })),
      },
      resolve: async (_root, { customerId, input }, ctx) => {
        // 1. Fetch live prices from InventoryItems (to snapshot)
        const inventoryItemIds = input.items.map((i) => i.inventoryItemId)
        const liveItems = await ctx.prisma.inventoryItems.findMany({
          where: { id: { in: inventoryItemIds } },
          include: { item: true },
        })

        type LiveItem = (typeof liveItems)[number]
        const liveMap = new Map<number, LiveItem>(liveItems.map((i) => [i.id, i]))

        // 2. Validate stock
        for (const item of input.items) {
          const live = liveMap.get(item.inventoryItemId)
          if (!live || live.quantity < item.quantity) {
            throw new Error(`Item ${item.itemId} has insufficient stock`)
          }
        }

        // 3. Calculate totals
        const orderItems = input.items.map((item) => {
          const live = liveMap.get(item.inventoryItemId)!
          return {
            inventoryItemId: item.inventoryItemId,
            itemId: item.itemId,
            quantity: item.quantity,
            priceSnapshot: live.price,          // snapshot NOW
            subtotal: live.price * item.quantity,
          }
        })
        const subtotal = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
        const discountType = input.discountType ?? 'NONE'
        const outlet = await ctx.prisma.outlet.findUnique({
          where: { id: input.outletId },
          select: { orgId: true, ownerId: true },
        })
        if (!outlet) throw new Error(`Outlet not found: ${input.outletId}`)

        const weeklyBnpcState =
          discountType === 'BNPC_SENIOR_CITIZEN' || discountType === 'BNPC_PWD'
            ? await getWeeklyBnpcState(ctx.prisma, String(customerId))
            : undefined

        const breakdown = await computeScPwdBreakdown(
          ctx.prisma,
          {
            discountType,
            discountRate: 0,
            totalPax: input.totalPax,
            scPwdPax: input.scPwdPax,
            total: subtotal,
            vatAmount: 0,
          },
          orderItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            price: item.priceSnapshot,
            priceAtSale: item.priceSnapshot,
          })),
          weeklyBnpcState,
        )

        // 4. Calculate delivery fee
        const deliveryConfig = await ctx.prisma.outletDeliveryConfig.findUnique({
          where: { outletId: input.outletId },
        })
        const deliveryFee = deliveryConfig?.baseDeliveryFee ?? 50

        const total = breakdown.netTotal + deliveryFee

        // 5. Generate transaction number
        const count = await ctx.prisma.kompraCOrder.count()
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const txnNumber = `EKU-${date}-${String(count + 1).padStart(4, '0')}`

        // 6. Create order in a transaction (atomic)
        return ctx.prisma.$transaction(async (tx) => {
          const order = await tx.kompraCOrder.create({
            data: {
              transactionNumber: txnNumber,
              customerId,
              outletId: input.outletId,
              deliveryAddressId: input.deliveryAddressId,
              paymentMethod: input.paymentMethod,
              customerNote: input.customerNote,
              scheduledDeliveryAt: input.scheduledDeliveryAt ? new Date(input.scheduledDeliveryAt) : null,
              subtotal,
              total,
              items: { create: orderItems },
              fees: {
                create: [
                  { type: 'delivery', label: 'Delivery fee', amount: deliveryFee },
                  ...(breakdown.discountAmount > 0
                    ? [{ type: 'voucher_discount' as const, label: `Discount (${discountType})`, amount: -breakdown.discountAmount }]
                    : []),
                ],
              },
              tracking: { create: { event: 'order_placed', actorType: 'customer', actorId: customerId } },
            },
            include: { items: true, fees: true, tracking: true },
          })

          const discountAuditEntries: any[] = []
          let cumulativeWeeklyBnpc = Number(weeklyBnpcState?.weeklyCapUsed ?? 0)
          for (const item of breakdown.itemBreakdown) {
            const itemDiscountAmount = Number(item.discountAmount ?? 0)
            if (itemDiscountAmount <= 0) continue

            if (discountType === 'BNPC_SENIOR_CITIZEN' || discountType === 'BNPC_PWD') {
              cumulativeWeeklyBnpc += itemDiscountAmount
            }

            discountAuditEntries.push({
              orgId: outlet.orgId,
              userId: outlet.ownerId,
              customerId: String(customerId),
              itemId: Number(item.itemId) || undefined,
              kompraOrderId: order.id,
              discountType,
              discountAmount: itemDiscountAmount,
              eligibleAmount: Number(item.eligibleAmount ?? 0),
              runningWeeklyBnpcTotal:
                discountType === 'BNPC_SENIOR_CITIZEN' || discountType === 'BNPC_PWD'
                  ? cumulativeWeeklyBnpc
                  : undefined,
            })
          }

          if (discountAuditEntries.length > 0) {
            await tx.discountAudit.createMany({ data: discountAuditEntries })
          }

          // 7. Deduct stock from InventoryItems
          for (const item of input.items) {
            await tx.inventoryItems.update({
              where: { id: item.inventoryItemId },
              data: { quantity: { decrement: item.quantity } },
            })
          }

          // 8. Refresh search index for this outlet
          const { refreshOutletItemSearchIndex } = await import('../../lib/ekumpra/nearestOutletsSearch.js')
          await refreshOutletItemSearchIndex(input.outletId)

          return order
        })
      },
    })

    // Outlet confirms the order
    t.nonNull.field('confirmKompraOrder', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        estimatedDeliveryAt: nullable(stringArg()),
        outletNote: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        return ctx.prisma.$transaction(async (tx) => {
          await tx.kompraCDeliveryTracking.create({
            data: { orderId: args.orderId, event: 'outlet_confirmed', actorType: 'outlet' },
          })
          return tx.kompraCOrder.update({
            where: { id: args.orderId },
            data: {
              status: 'confirmed',
              estimatedDeliveryAt: args.estimatedDeliveryAt ? new Date(args.estimatedDeliveryAt) : null,
              outletNote: args.outletNote,
            },
            include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
          })
        })
      },
    })

    // Rider picked up — order goes in_delivery
    t.nonNull.field('markOrderInDelivery', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        riderName: nonNull(stringArg()),
        riderPhone: nonNull(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        return ctx.prisma.$transaction(async (tx) => {
          await tx.kompraCDeliveryTracking.create({
            data: { orderId: args.orderId, event: 'rider_picked_up', actorType: 'rider' },
          })
          return tx.kompraCOrder.update({
            where: { id: args.orderId },
            data: { status: 'in_delivery', riderName: args.riderName, riderPhone: args.riderPhone },
            include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
          })
        })
      },
    })

    // Customer confirms delivery received
    t.nonNull.field('confirmOrderReceived', {
      type: 'KompraCOrder',
      args: { orderId: nonNull(intArg()), customerId: nonNull(intArg()) },
      resolve: async (_root, { orderId, customerId }, ctx) => {
        return ctx.prisma.$transaction(async (tx) => {
          await tx.kompraCDeliveryTracking.create({
            data: { orderId, event: 'delivered', actorType: 'customer', actorId: customerId },
          })
          return tx.kompraCOrder.update({
            where: { id: orderId },
            data: { status: 'received', deliveredAt: new Date() },
            include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
          })
        })
      },
    })

    // Cancel order (only before in_delivery)
    t.nonNull.field('cancelKompraOrder', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        actorType: nonNull(stringArg()),
        actorId: nonNull(intArg()),
        reason: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        const order = await ctx.prisma.kompraCOrder.findUnique({ where: { id: args.orderId } })
        if (!order) throw new Error('Order not found')
        if (['in_delivery', 'received', 'returned'].includes(order.status)) {
          throw new Error('Cannot cancel an order that is already in delivery or completed')
        }

        return ctx.prisma.$transaction(async (tx) => {
          // Restore stock
          const orderItems = await tx.kompraCOrderItem.findMany({ where: { orderId: args.orderId } })
          for (const item of orderItems) {
            await tx.inventoryItems.update({
              where: { id: item.inventoryItemId },
              data: { quantity: { increment: item.quantity } },
            })
          }

          await tx.kompraCDeliveryTracking.create({
            data: { orderId: args.orderId, event: 'cancelled', note: args.reason, actorType: args.actorType, actorId: args.actorId },
          })

          return tx.kompraCOrder.update({
            where: { id: args.orderId },
            data: { status: 'cancelled' },
            include: { items: true, fees: true, tracking: { orderBy: { statusAt: 'asc' } } },
          })
        })
      },
    })
  },
})

// ─── PLACEHOLDER for OutletCatalogResult ──────────────────────────────────────
// Add this type to hold catalog response

export const OutletCatalogResultType = objectType({
  name: 'OutletCatalogResult',
  definition(t) {
    t.nonNull.int('outletId')
    t.nonNull.list.nonNull.field('items', { type: 'InventoryItems' })
  },
})
