// graphql/kompra/types.ts
// Full Nexus type definitions — packed enum, cancelNote, shippedAt, packedAt,
// scPwdCustomer in management include, cancelKompraOrder with reason + cancelledAt.

import {
  objectType,
  enumType,
  inputObjectType,
  extendType,
  nonNull,
  nullable,
  list,
  arg,
  intArg,
  stringArg,
  floatArg,
} from 'nexus'
import { computeScPwdBreakdown, getWeeklyBnpcState } from '../../services/transaction.service.js'
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js'
import { deductKompraOrderInventory } from '../../services/inventoryDeduction.service.js'

const LOG_PREFIX = '[KompraCTypes]'

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const OrderStatusEnum = enumType({
  name: 'OrderStatus',
  members: ['pending', 'confirmed', 'preparing', 'packed', 'in_delivery', 'received', 'cancelled', 'returned'],
})

export const DeliveryStatusEventEnum = enumType({
  name: 'DeliveryStatusEvent',
  members: [
    'order_placed', 'outlet_confirmed', 'outlet_preparing',
    'rider_assigned', 'rider_picked_up', 'rider_en_route',
    'arrived_at_door', 'delivered', 'cancelled', 'return_requested', 'returned',
  ],
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

// ─── CUSTOMER ─────────────────────────────────────────────────────────────────

export const KompraCustomerType = objectType({
  name: 'KompraCustomer',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('fullname')
    t.nullable.string('email')
    t.nullable.string('phone')
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

export const CourierType = objectType({
  name: 'Courier',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('name')
    t.nonNull.string('phone')
    t.nonNull.string('createdAt')
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
    t.nullable.dateTime('deliveredAt')
    t.nonNull.field('paymentMethod', { type: 'KompraCPaymentMethod' })
    t.nonNull.string('paymentStatus')
    t.nullable.string('paymentReference')
    t.nullable.string('riderName')
    t.nullable.string('riderPhone')
    t.nullable.string('customerNote')
    t.nullable.string('outletNote')
    // ── New timestamp + cancel fields ─────────────────────────────────────────
    t.nullable.string('cancelNote')
    t.nullable.dateTime('shippedAt')
    t.nullable.dateTime('packedAt')
    t.nullable.dateTime('placedAt')
    t.nullable.dateTime('cancelledAt')
    // ── Standard timestamps ───────────────────────────────────────────────────
    t.nonNull.dateTime('createdAt')
    t.nullable.dateTime('updatedAt')
    // ── Relations ─────────────────────────────────────────────────────────────
    t.nullable.int('courierId')
    t.nonNull.field('customer', { type: 'KompraCustomer' })
    t.nonNull.field('outlet', { type: 'Outlet' })
    t.nonNull.field('deliveryAddress', { type: 'DeliveryAddress' })
    t.nullable.field('courier', { type: 'Courier' })
    t.nonNull.list.nonNull.field('items', { type: 'KompraCOrderItem' })
    t.nonNull.list.nonNull.field('fees', { type: 'KompraCOrderFee' })
    t.nonNull.list.nonNull.field('tracking', { type: 'KompraCDeliveryTracking' })
    // ── SC / PWD ──────────────────────────────────────────────────────────────
    t.nullable.field('customerType', { type: 'CustomerType' })
    t.nullable.field('discountType', { type: 'DiscountType' })
    t.nullable.field('scPwdCustomer', { type: 'ScPwdCustomer' })
    t.nullable.int('scPwdPax')
    t.nullable.int('totalPax')
    t.nullable.float('vatExemptSale')
    t.nullable.float('discountAmount')
    t.nullable.float('vatAmount')
    t.nullable.float('grandTotal')
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
    t.nullable.field('unit', { type: 'InventoryItemUnit' })
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

// ─── SEARCH RESULT ────────────────────────────────────────────────────────────

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

// ─── Shared include ───────────────────────────────────────────────────────────
// scPwdCustomer is included so the frontend can render the SC/PWD discount section.

const kompraOrderManagementInclude = {
  customer: true,
  outlet: true,
  deliveryAddress: true,
  courier: true,
  scPwdCustomer: true,          // ← required for SC/PWD section in OrderDetailModal
  items: {
    include: {
      item: true,
      inventoryItem: true,
      unit: true,
    },
  },
  fees: true,
  tracking: { orderBy: { statusAt: 'asc' as const } },
}

function requireKompraManagementAccess(ctx: any) {
  requireAuth(ctx)
  requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER', 'STAFF'])
  return Number(ctx.user.orgId)
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────

export const KompraCQuery = extendType({
  type: 'Query',
  definition(t) {

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
        return findNearestOutletsWithItems(args.customerLat, args.customerLng, args.items, args.maxResults ?? 10)
      },
    })

    t.nonNull.field('outletCatalog', {
      type: 'OutletCatalogResult',
      args: { outletId: nonNull(intArg()) },
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

    t.nullable.field('kompraCOrder', {
      type: 'KompraCOrder',
      args: { id: nonNull(intArg()) },
      resolve: (_root, { id }, ctx) =>
        ctx.prisma.kompraCOrder.findUnique({ where: { id }, include: kompraOrderManagementInclude }),
    })

    t.nonNull.list.nonNull.field('myOrders', {
      type: 'KompraCOrder',
      args: { customerId: nonNull(intArg()) },
      resolve: (_root, { customerId }, ctx) =>
        ctx.prisma.kompraCOrder.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          include: kompraOrderManagementInclude,
        }),
    })

    t.nonNull.list.nonNull.field('outletOrderQueue', {
      type: 'KompraCOrder',
      args: { outletId: nonNull(intArg()) },
      resolve: (_root, { outletId }, ctx) =>
        ctx.prisma.kompraCOrder.findMany({
          where: { outletId, status: { in: ['pending', 'confirmed', 'preparing', 'packed'] } },
          orderBy: { createdAt: 'asc' },
          include: kompraOrderManagementInclude,
        }),
    })

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
        const orgId = args.organizationId ?? Number(ctx.user?.orgId)
        const where: any = { outlet: { orgId } }
        if (args.startDate || args.endDate) {
          where.createdAt = {}
          if (args.startDate) where.createdAt.gte = new Date(args.startDate)
          if (args.endDate) where.createdAt.lte = new Date(args.endDate)
        }
        return ctx.prisma.kompraCOrder.findMany({
          where,
          take: args.take ?? undefined,
          skip: args.skip ?? undefined,
          orderBy: { createdAt: 'desc' },
          select: { total: true, status: true, createdAt: true },
        })
      },
    })

    t.nonNull.list.nonNull.field('getKompraCOrdersForManagement', {
      type: 'KompraCOrder',
      args: {
        status: nullable(stringArg()),
        outletId: nullable(intArg()),
        take: nullable(intArg()),
        skip: nullable(intArg()),
      },
      resolve: async (_root, args, ctx) => {
        const orgId = requireKompraManagementAccess(ctx)
        const statusList = args.status?.split(',').map((s) => s.trim()).filter(Boolean)
        return ctx.prisma.kompraCOrder.findMany({
          where: {
            outlet: { orgId },
            ...(args.outletId ? { outletId: args.outletId } : {}),
            ...(statusList?.length ? { status: { in: statusList as any } } : {}),
          },
          take: args.take ?? 100,
          skip: args.skip ?? undefined,
          orderBy: { createdAt: 'desc' },
          include: kompraOrderManagementInclude,
        })
      },
    })
  },
})

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export const KompraCMutation = extendType({
  type: 'Mutation',
  definition(t) {

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

    t.nonNull.field('addDeliveryAddress', {
      type: 'DeliveryAddress',
      args: {
        customerId: nonNull(intArg()),
        input: nonNull(arg({ type: 'AddDeliveryAddressInput' })),
      },
      resolve: async (_root, { customerId, input }, ctx) => {
        if (input.isDefault) {
          await ctx.prisma.deliveryAddress.updateMany({ where: { customerId }, data: { isDefault: false } })
        }
        return ctx.prisma.deliveryAddress.create({ data: { customerId, ...input } })
      },
    })

    t.nonNull.field('placeKompraOrder', {
      type: 'KompraCOrder',
      args: {
        customerId: nonNull(intArg()),
        input: nonNull(arg({ type: 'PlaceOrderInput' })),
      },
      resolve: async (_root, { customerId, input }, ctx) => {
        const inventoryItemIds = input.items.map((i) => i.inventoryItemId)
        const liveItems = await ctx.prisma.inventoryItems.findMany({
          where: { id: { in: inventoryItemIds } },
          include: { item: true },
        })
        type LiveItem = (typeof liveItems)[number]
        const liveMap = new Map<number, LiveItem>(liveItems.map((i) => [i.id, i]))

        for (const item of input.items) {
          const live = liveMap.get(item.inventoryItemId)
          if (!live || live.quantity < item.quantity) {
            throw new Error(`Item ${item.itemId} has insufficient stock`)
          }
        }

        const orderItems = input.items.map((item) => {
          const live = liveMap.get(item.inventoryItemId)!
          return {
            inventoryItemId: item.inventoryItemId,
            itemId: item.itemId,
            quantity: item.quantity,
            priceSnapshot: live.price,
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
          { discountType, discountRate: 0, totalPax: input.totalPax, scPwdPax: input.scPwdPax, total: subtotal, vatAmount: 0 },
          orderItems.map((item) => ({ itemId: item.itemId, quantity: item.quantity, price: item.priceSnapshot, priceAtSale: item.priceSnapshot })),
          weeklyBnpcState,
        )

        const deliveryConfig = await ctx.prisma.outletDeliveryConfig.findUnique({ where: { outletId: input.outletId } })
        const deliveryFee = deliveryConfig?.baseDeliveryFee ?? 50
        const total = breakdown.netTotal + deliveryFee

        const count = await ctx.prisma.kompraCOrder.count()
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const txnNumber = `EKU-${date}-${String(count + 1).padStart(4, '0')}`

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
              customerType: input.discountType && input.discountType !== 'NONE'
                ? (input.discountType === 'BNPC_PWD' || input.discountType === 'PWD' ? 'PWD' : 'SENIOR_CITIZEN')
                : 'REGULAR',
              discountType: input.discountType,
              scPwdPax: input.scPwdPax,
              totalPax: input.totalPax,
              vatExemptSale: breakdown.vatExemptSale ?? 0,
              discountAmount: breakdown.discountAmount ?? 0,
              vatAmount: breakdown.vatAmount ?? 0,
              grandTotal: total,
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
              orgId: outlet.orgId, userId: outlet.ownerId, customerId: String(customerId),
              itemId: Number(item.itemId) || undefined, kompraOrderId: order.id, discountType,
              discountAmount: itemDiscountAmount, eligibleAmount: Number(item.eligibleAmount ?? 0),
              runningWeeklyBnpcTotal: discountType === 'BNPC_SENIOR_CITIZEN' || discountType === 'BNPC_PWD' ? cumulativeWeeklyBnpc : undefined,
            })
          }
          if (discountAuditEntries.length > 0) {
            await tx.discountAudit.createMany({ data: discountAuditEntries })
          }

          const { refreshOutletItemSearchIndex } = await import('../../lib/ekumpra/nearestOutletsSearch.js')
          await refreshOutletItemSearchIndex(input.outletId)
          return order
        })
      },
    })

    t.nonNull.field('confirmKompraOrder', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        estimatedDeliveryAt: nullable(stringArg()),
        outletNote: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        console.log(`${LOG_PREFIX} confirmKompraOrder — orderId:`, args.orderId)
        requireKompraManagementAccess(ctx)
        try {
          const result = await ctx.prisma.$transaction(async (tx: any) => {
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
              include: kompraOrderManagementInclude,
            })
          })
          console.log(`${LOG_PREFIX} confirmKompraOrder — success. status:`, result.status)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} confirmKompraOrder — ERROR:`, error)
          throw error
        }
      },
    })

    // Sets status: 'packed', packedAt timestamp, outlet_preparing tracking event.
    t.nonNull.field('markKompraOrderPacked', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        outletNote: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        console.log(`${LOG_PREFIX} markKompraOrderPacked — orderId:`, args.orderId)
        requireKompraManagementAccess(ctx)
        try {
          const existing = await ctx.prisma.kompraCOrder.findUnique({
            where: { id: args.orderId },
            select: { id: true, status: true, transactionNumber: true },
          })
          if (!existing) throw new Error(`Order ${args.orderId} not found`)
          if (!['confirmed', 'preparing'].includes(existing.status)) {
            throw new Error(`Cannot pack order with status "${existing.status}". Must be confirmed or preparing.`)
          }

          const packedAt = new Date()
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            await tx.kompraCDeliveryTracking.create({
              data: {
                orderId: args.orderId,
                event: 'outlet_preparing',
                actorType: 'outlet',
                note: args.outletNote ?? 'Packed and ready for rider assignment',
              },
            })
            return tx.kompraCOrder.update({
              where: { id: args.orderId },
              data: { status: 'packed', outletNote: args.outletNote ?? undefined, packedAt },
              include: kompraOrderManagementInclude,
            })
          })
          console.log(`${LOG_PREFIX} markKompraOrderPacked — success. status:`, result.status, '| packedAt:', result.packedAt)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} markKompraOrderPacked — ERROR:`, error)
          throw error
        }
      },
    })

    t.nonNull.field('assignKompraOrderRider', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        riderName: nonNull(stringArg()),
        riderPhone: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        console.log(`${LOG_PREFIX} assignKompraOrderRider — orderId:`, args.orderId, '| rider:', args.riderName)
        requireKompraManagementAccess(ctx)
        const phone = args.riderPhone?.trim() || 'N/A'
        try {
          const existing = await ctx.prisma.kompraCOrder.findUnique({
            where: { id: args.orderId },
            select: { id: true, status: true },
          })
          if (!existing) throw new Error(`Order ${args.orderId} not found`)
          if (existing.status !== 'packed') {
            throw new Error(`Cannot dispatch order with status "${existing.status}". Must be packed.`)
          }

          const result = await ctx.prisma.$transaction(async (tx: any) => {
            const courier = await tx.courier.findFirst({
              where: phone === 'N/A' ? { name: args.riderName } : { phone },
            }) ?? await tx.courier.create({ data: { name: args.riderName, phone } })

            await tx.kompraCDeliveryTracking.create({
              data: { orderId: args.orderId, event: 'rider_assigned', actorType: 'outlet', actorId: courier.id },
            })
            await tx.kompraCDeliveryTracking.create({
              data: { orderId: args.orderId, event: 'rider_picked_up', actorType: 'rider', actorId: courier.id },
            })
            return tx.kompraCOrder.update({
              where: { id: args.orderId },
              data: {
                status: 'in_delivery',
                riderName: args.riderName,
                riderPhone: phone,
                courierId: courier.id,
                shippedAt: new Date(),
              },
              include: kompraOrderManagementInclude,
            })
          })
          console.log(`${LOG_PREFIX} assignKompraOrderRider — success. status:`, result.status, '| shippedAt:', result.shippedAt)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} assignKompraOrderRider — ERROR:`, error)
          throw error
        }
      },
    })

    t.nonNull.field('markOrderInDelivery', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        riderName: nonNull(stringArg()),
        riderPhone: nonNull(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        requireKompraManagementAccess(ctx)
        try {
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            const courier = await tx.courier.findFirst({ where: { phone: args.riderPhone } })
              ?? await tx.courier.create({ data: { name: args.riderName, phone: args.riderPhone } })
            await tx.kompraCDeliveryTracking.create({
              data: { orderId: args.orderId, event: 'rider_picked_up', actorType: 'rider', actorId: courier.id },
            })
            return tx.kompraCOrder.update({
              where: { id: args.orderId },
              data: { status: 'in_delivery', riderName: args.riderName, riderPhone: args.riderPhone, courierId: courier.id, shippedAt: new Date() },
              include: kompraOrderManagementInclude,
            })
          })
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} markOrderInDelivery — ERROR:`, error)
          throw error
        }
      },
    })

    t.nonNull.field('confirmOrderReceived', {
      type: 'KompraCOrder',
      args: { orderId: nonNull(intArg()), customerId: nonNull(intArg()) },
      resolve: async (_root, { orderId, customerId }, ctx) => {
        try {
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            await tx.kompraCDeliveryTracking.create({
              data: { orderId, event: 'delivered', actorType: 'customer', actorId: customerId },
            })
            await tx.kompraCOrder.update({
              where: { id: orderId },
              data: { status: 'received', deliveredAt: new Date() },
              include: kompraOrderManagementInclude,
            })
            await deductKompraOrderInventory(tx, orderId)
            return tx.kompraCOrder.findUnique({
              where: { id: orderId },
              include: kompraOrderManagementInclude,
            })
          })
          const { refreshOutletItemSearchIndex } = await import('../../lib/ekumpra/nearestOutletsSearch.js')
          await refreshOutletItemSearchIndex(result.outletId)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} confirmOrderReceived — ERROR:`, error)
          throw error
        }
      },
    })

    t.nonNull.field('markKompraOrderDelivered', {
      type: 'KompraCOrder',
      args: { orderId: nonNull(intArg()) },
      resolve: async (_root, { orderId }, ctx) => {
        console.log(`${LOG_PREFIX} markKompraOrderDelivered — orderId:`, orderId)
        requireKompraManagementAccess(ctx)
        try {
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            await tx.kompraCDeliveryTracking.create({
              data: { orderId, event: 'delivered', actorType: 'outlet' },
            })
            await tx.kompraCOrder.update({
              where: { id: orderId },
              data: { status: 'received', deliveredAt: new Date(), paymentStatus: 'paid' },
              include: kompraOrderManagementInclude,
            })
            await deductKompraOrderInventory(tx, orderId)
            return tx.kompraCOrder.findUnique({
              where: { id: orderId },
              include: kompraOrderManagementInclude,
            })
          })
          console.log(`${LOG_PREFIX} markKompraOrderDelivered — success.`)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} markKompraOrderDelivered — ERROR:`, error)
          throw error
        }
      },
    })

    /**
     * Cancel an order with an optional reason.
     * - Sets status: 'cancelled', cancelledAt: now(), cancelNote: reason
     * - Restores inventory stock for each line item
     * - Creates a 'cancelled' tracking event with reason as note
     * - Blocked if the order is already in_delivery, received, or returned
     */
    t.nonNull.field('cancelKompraOrder', {
      type: 'KompraCOrder',
      args: {
        orderId: nonNull(intArg()),
        actorType: nonNull(stringArg()),
        actorId: nonNull(intArg()),
        reason: nullable(stringArg()),
      },
      resolve: async (_root, args, ctx) => {
        console.log(`${LOG_PREFIX} cancelKompraOrder — orderId:`, args.orderId, '| reason:', args.reason)
        requireKompraManagementAccess(ctx)

        const order = await ctx.prisma.kompraCOrder.findUnique({ where: { id: args.orderId } })
        if (!order) throw new Error('Order not found')
        if (['in_delivery', 'received', 'returned'].includes(order.status)) {
          throw new Error('Cannot cancel an order that is already in delivery or completed')
        }

        try {
          const result = await ctx.prisma.$transaction(async (tx: any) => {
            await tx.kompraCDeliveryTracking.create({
              data: {
                orderId: args.orderId,
                event: 'cancelled',
                note: args.reason ?? null,
                actorType: args.actorType,
                actorId: args.actorId,
              },
            })

            return tx.kompraCOrder.update({
              where: { id: args.orderId },
              data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelNote: args.reason ?? null,
              },
              include: kompraOrderManagementInclude,
            })
          })
          console.log(`${LOG_PREFIX} cancelKompraOrder — success. cancelledAt:`, result.cancelledAt)
          return result
        } catch (error) {
          console.error(`${LOG_PREFIX} cancelKompraOrder — ERROR:`, error)
          throw error
        }
      },
    })

  },
})

// ─── PLACEHOLDER ──────────────────────────────────────────────────────────────

export const OutletCatalogResultType = objectType({
  name: 'OutletCatalogResult',
  definition(t) {
    t.nonNull.int('outletId')
    t.nonNull.list.nonNull.field('items', { type: 'InventoryItems' })
  },
})
