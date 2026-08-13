import type { PrismaClient } from '@prisma/client'

export type TimelineEventType =
  | 'PURCHASE_ORDER'
  | 'DELIVERY'
  | 'WALLET'
  | 'MANDATE'
  | 'INVENTORY'
  | 'SYSTEM'
  | 'ORGANIZATION'
  | 'NOTIFICATION'

export type TimelineStatus = 'SUCCESS' | 'WARNING' | 'INFO' | 'ERROR' | 'PENDING'
export type TimelineSort = 'NEWEST' | 'OLDEST'

export interface TimelineDateRange {
  start?: Date | null
  end?: Date | null
}

export interface TimelineFilters {
  supplierOrgId: number
  search?: string | null
  status?: TimelineStatus | null
  eventTypes?: TimelineEventType[] | null
  dateRange?: TimelineDateRange | null
  limit?: number | null
  offset?: number | null
  sort?: TimelineSort | null
}

export interface TimelineEvent {
  id: string
  eventType: TimelineEventType
  title: string
  description: string
  status: TimelineStatus
  referenceId?: string | null
  referenceType?: string | null
  organization?: string | null
  createdAt: Date
  actor?: string | null
  icon: string
  color: string
  actionLabel?: string | null
  actionRoute?: string | null
  metadata: Record<string, unknown>
}

export interface TimelineGroup {
  label: string
  events: TimelineEvent[]
}

export interface TimelineSummary {
  total: number
  purchaseOrders: number
  deliveries: number
  wallet: number
  mandates: number
  inventory: number
  notifications: number
  attention: number
}

export interface TimelineResult {
  groups: TimelineGroup[]
  totalCount: number
  hasNextPage: boolean
  summary: TimelineSummary
}

const EVENT_CONFIG: Record<TimelineEventType, { icon: string; color: string }> = {
  PURCHASE_ORDER: { icon: 'ShoppingCart', color: '#2563EB' },
  DELIVERY: { icon: 'Truck', color: '#0EA5E9' },
  WALLET: { icon: 'Wallet', color: '#16A34A' },
  MANDATE: { icon: 'Handshake', color: '#7C3AED' },
  INVENTORY: { icon: 'Package', color: '#F59E0B' },
  SYSTEM: { icon: 'Settings', color: '#64748B' },
  ORGANIZATION: { icon: 'Building2', color: '#475569' },
  NOTIFICATION: { icon: 'Bell', color: '#DC2626' },
}

function statusForPO(status: string): TimelineStatus {
  if (status === 'DELIVERED' || status === 'ACCEPTED') return 'SUCCESS'
  if (status === 'REJECTED' || status === 'CANCELLED') return 'ERROR'
  if (status === 'IN_TRANSIT') return 'INFO'
  return 'PENDING'
}

function statusForDelivery(status: string): TimelineStatus {
  if (status === 'DELIVERED') return 'SUCCESS'
  if (status === 'FAILED') return 'ERROR'
  if (status === 'IN_TRANSIT') return 'INFO'
  return 'PENDING'
}

function statusForMandate(status: string): TimelineStatus {
  if (status === 'COMPLETED' || status === 'SETTLED' || status === 'FUNDED') return 'SUCCESS'
  if (status === 'DISPUTED' || status === 'CANCELLED' || status === 'REFUNDED') return 'ERROR'
  if (status === 'PENDING' || status === 'ACCEPTED') return 'PENDING'
  return 'INFO'
}

function statusForLedger(status: string, type: string): TimelineStatus {
  if (status === 'REVERSED') return 'ERROR'
  if (status === 'HELD') return 'WARNING'
  return type === 'CREDIT' ? 'SUCCESS' : 'INFO'
}

function normalizeText(value?: string | null) {
  return (value ?? '').toLowerCase()
}

function inDateRange(createdAt: Date, range?: TimelineDateRange | null) {
  if (!range) return true
  if (range.start && createdAt < range.start) return false
  if (range.end && createdAt > range.end) return false
  return true
}

function groupLabel(createdAt: Date, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)
  const startOfLast7 = new Date(startOfToday)
  startOfLast7.setDate(startOfToday.getDate() - 6)

  if (createdAt >= startOfToday) return 'Today'
  if (createdAt >= startOfYesterday) return 'Yesterday'
  if (createdAt >= startOfLast7) return 'Last 7 Days'
  return 'Earlier'
}

function createEvent(input: Omit<TimelineEvent, 'icon' | 'color'>): TimelineEvent {
  const config = EVENT_CONFIG[input.eventType]
  return { ...input, icon: config.icon, color: config.color }
}

function matchesSearch(event: TimelineEvent, query: string) {
  const haystack = [
    event.title,
    event.description,
    event.referenceId,
    event.referenceType,
    event.organization,
    event.actor,
    event.status,
    event.eventType,
  ]
    .map(normalizeText)
    .join(' ')
  return haystack.includes(query)
}

function summarize(events: TimelineEvent[]): TimelineSummary {
  return {
    total: events.length,
    purchaseOrders: events.filter((event) => event.eventType === 'PURCHASE_ORDER').length,
    deliveries: events.filter((event) => event.eventType === 'DELIVERY').length,
    wallet: events.filter((event) => event.eventType === 'WALLET').length,
    mandates: events.filter((event) => event.eventType === 'MANDATE').length,
    inventory: events.filter((event) => event.eventType === 'INVENTORY').length,
    notifications: events.filter((event) => event.eventType === 'NOTIFICATION').length,
    attention: events.filter((event) => event.status === 'WARNING' || event.status === 'ERROR').length,
  }
}

function groupEvents(events: TimelineEvent[]): TimelineGroup[] {
  const orderedLabels = ['Today', 'Yesterday', 'Last 7 Days', 'Earlier']
  const groups = new Map<string, TimelineEvent[]>()
  for (const event of events) {
    const label = groupLabel(event.createdAt)
    groups.set(label, [...(groups.get(label) ?? []), event])
  }
  return orderedLabels
    .map((label) => ({ label, events: groups.get(label) ?? [] }))
    .filter((group) => group.events.length > 0)
}

export async function getSupplierOrderTimeline(
  prisma: PrismaClient,
  filters: TimelineFilters
): Promise<TimelineResult> {
  const {
    supplierOrgId,
    search,
    status,
    eventTypes,
    dateRange,
    sort = 'NEWEST',
    limit = 30,
    offset = 0,
  } = filters
  const take = Math.max(25, Math.min((limit ?? 30) * 3, 150))
  const orderBy = { createdAt: sort === 'OLDEST' ? 'asc' as const : 'desc' as const }
  const enabledTypes = new Set<TimelineEventType>(eventTypes?.length ? eventTypes : Object.keys(EVENT_CONFIG) as TimelineEventType[])

  const events: TimelineEvent[] = []

  const [purchaseOrders, deliveries, wallet, mandateTransactions, mandateOffers, supplierItems, notifications, auditLogs] =
    await Promise.all([
      enabledTypes.has('PURCHASE_ORDER')
        ? prisma.purchaseOrder.findMany({
            where: { supplierOrgId, ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}) },
            include: { buyerOrg: true, },
            orderBy,
            take,
          })
        : [],
      enabledTypes.has('DELIVERY')
        ? prisma.delivery.findMany({
            where: {
              po: { supplierOrgId },
              ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            include: { po: { include: { buyerOrg: true,  } } },
            orderBy,
            take,
          })
        : [],
      enabledTypes.has('WALLET')
        ? prisma.wallet.findUnique({
            where: { orgId: supplierOrgId },
            include: {
              organization: true,
              ledgerEntries: {
                where: {
                  deletedAt: null,
                  ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
                },
                orderBy,
                take,
              },
            },
          })
        : null,
      enabledTypes.has('MANDATE')
        ? prisma.mandateTransaction.findMany({
            where: {
              supplierOrgId,
              deletedAt: null,
              ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            include: { mandate: true },
            orderBy,
            take,
          })
        : [],
      enabledTypes.has('MANDATE')
        ? prisma.mandateOffer.findMany({
            where: {
              supplierOrgId,
              deletedAt: null,
              ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            include: { mandate: true },
            orderBy,
            take,
          })
        : [],
      enabledTypes.has('INVENTORY')
        ? prisma.supplierItem.findMany({
            where: {
              catalog: { organizationId: supplierOrgId },
              ...(dateRange?.start || dateRange?.end ? { updatedAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            include: { catalog: { include: { organization: true } } },
            orderBy: { updatedAt: orderBy.createdAt },
            take,
          })
        : [],
      enabledTypes.has('NOTIFICATION')
        ? prisma.notification.findMany({
            where: {
              orgId: supplierOrgId,
              deletedAt: null,
              ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            orderBy,
            take,
          })
        : [],
      enabledTypes.has('SYSTEM') || enabledTypes.has('ORGANIZATION')
        ? prisma.auditLog.findMany({
            where: {
              orgId: supplierOrgId,
              deletedAt: null,
              ...(dateRange?.start || dateRange?.end ? { createdAt: { gte: dateRange?.start ?? undefined, lte: dateRange?.end ?? undefined } } : {}),
            },
            include: { user: true },
            orderBy,
            take,
          })
        : [],
    ])

  for (const po of purchaseOrders) {
    events.push(createEvent({
      id: `po:${po.id}`,
      eventType: 'PURCHASE_ORDER',
      title: `Purchase order ${po.poNumber}`,
      description: `${po.buyerOrg.name} placed an order for ${po.outlet.name}.`,
      status: statusForPO(po.status),
      referenceId: po.id,
      referenceType: 'PurchaseOrder',
      organization: po.buyerOrg.name,
      createdAt: po.createdAt,
      actor: po.buyerOrg.name,
      actionLabel: 'View order',
      actionRoute: `/po-inbox?poId=${po.id}`,
      metadata: { poNumber: po.poNumber, poStatus: po.status, totalAmount: po.totalAmount, outletName: po.outlet.name },
    }))
  }

  for (const delivery of deliveries) {
    events.push(createEvent({
      id: `delivery:${delivery.id}`,
      eventType: 'DELIVERY',
      title: `Delivery ${delivery.status.replace('_', ' ').toLowerCase()}`,
      description: `${delivery.po.poNumber} is scheduled for ${delivery.scheduledDate.toLocaleDateString('en-PH')}.`,
      status: statusForDelivery(delivery.status),
      referenceId: delivery.poId,
      referenceType: 'Delivery',
      organization: delivery.po.buyerOrg.name,
      createdAt: delivery.updatedAt ?? delivery.createdAt,
      actor: delivery.driverName ?? delivery.po.buyerOrg.name,
      actionLabel: 'Open delivery',
      actionRoute: `/deliveries?poId=${delivery.poId}`,
      metadata: {
        deliveryId: delivery.id,
        poNumber: delivery.po.poNumber,
        deliveryStatus: delivery.status,
        scheduledDate: delivery.scheduledDate,
        deliveredAt: delivery.deliveredAt,
        driverName: delivery.driverName,
      },
    }))
  }

  for (const entry of wallet?.ledgerEntries ?? []) {
    const isCredit = entry.type === 'CREDIT'
    events.push(createEvent({
      id: `wallet:${entry.id}`,
      eventType: 'WALLET',
      title: `${isCredit ? 'Wallet credited' : 'Wallet debited'}`,
      description: `${entry.sourceType.replace(/_/g, ' ').toLowerCase()} ${isCredit ? 'added' : 'deducted'} PHP ${entry.amount.toLocaleString('en-PH')}.`,
      status: statusForLedger(entry.status, entry.type),
      referenceId: entry.referenceId ?? String(entry.id),
      referenceType: entry.sourceType,
      organization: wallet?.organization.name ?? null,
      createdAt: entry.createdAt,
      actor: 'Finance system',
      actionLabel: 'View wallet',
      actionRoute: '/wallet',
      metadata: { ledgerEntryId: entry.id, amount: entry.amount, balanceAfter: entry.balanceAfter, ledgerStatus: entry.status, sourceType: entry.sourceType },
    }))
  }

  for (const tx of mandateTransactions) {
    events.push(createEvent({
      id: `mandate-transaction:${tx.id}`,
      eventType: 'MANDATE',
      title: `Mandate transaction ${tx.status.toLowerCase()}`,
      description: `${tx.mandate.quantity} ${tx.mandate.unitType} ${tx.mandate.category} mandate worth PHP ${tx.amount.toLocaleString('en-PH')}.`,
      status: statusForMandate(tx.status),
      referenceId: tx.id,
      referenceType: 'MandateTransaction',
      organization: null,
      createdAt: tx.updatedAt ?? tx.createdAt,
      actor: 'Mandate marketplace',
      actionLabel: 'View mandates',
      actionRoute: '/supplier-links',
      metadata: { mandateId: tx.mandateId, amount: tx.amount, feeAmount: tx.feeAmount, netAmount: tx.netAmount, settlementType: tx.settlementType, transactionStatus: tx.status },
    }))
  }

  for (const offer of mandateOffers) {
    events.push(createEvent({
      id: `mandate-offer:${offer.id}`,
      eventType: 'MANDATE',
      title: `Mandate offer ${offer.status.toLowerCase()}`,
      description: `Offer for ${offer.availableQty} ${offer.mandate.unitType} ${offer.mandate.category} at PHP ${offer.price.toLocaleString('en-PH')}.`,
      status: statusForMandate(offer.status),
      referenceId: offer.id,
      referenceType: 'MandateOffer',
      organization: null,
      createdAt: offer.updatedAt ?? offer.createdAt,
      actor: 'Supplier team',
      actionLabel: 'View offer',
      actionRoute: '/supplier-links',
      metadata: { mandateId: offer.mandateId, price: offer.price, availableQty: offer.availableQty, offerStatus: offer.status, expiresAt: offer.expiresAt },
    }))
  }

  for (const item of supplierItems) {
    events.push(createEvent({
      id: `inventory:${item.id}:${item.updatedAt.toISOString()}`,
      eventType: 'INVENTORY',
      title: item.availableQty <= item.moq ? 'Inventory needs attention' : 'Catalog inventory updated',
      description: `${item.name} now has ${item.availableQty} ${item.unit} available.`,
      status: item.availableQty <= item.moq ? 'WARNING' : 'INFO',
      referenceId: item.id,
      referenceType: 'SupplierItem',
      organization: item.catalog.organization.name,
      createdAt: item.updatedAt,
      actor: 'Catalog',
      actionLabel: 'View catalog',
      actionRoute: '/catalog',
      metadata: { sku: item.sku, unit: item.unit, moq: item.moq, availableQty: item.availableQty, isActive: item.isActive },
    }))
  }

  for (const notification of notifications) {
    events.push(createEvent({
      id: `notification:${notification.id}`,
      eventType: 'NOTIFICATION',
      title: notification.title,
      description: notification.message,
      status: notification.isRead ? 'INFO' : 'WARNING',
      referenceId: String(notification.id),
      referenceType: 'Notification',
      organization: null,
      createdAt: notification.createdAt,
      actor: 'Kompra',
      actionLabel: 'View notifications',
      actionRoute: '/notifications',
      metadata: { notificationType: notification.type, isRead: notification.isRead, outletId: notification.outletId, itemId: notification.itemId },
    }))
  }

  for (const log of auditLogs) {
    const eventType: TimelineEventType = log.pageKey?.toLowerCase().includes('organization') ? 'ORGANIZATION' : 'SYSTEM'
    if (!enabledTypes.has(eventType)) continue
    events.push(createEvent({
      id: `audit:${log.id}`,
      eventType,
      title: `${log.action.replace('_', ' ').toLowerCase()} on ${log.pageKey}`,
      description: `${log.recordType ?? 'Record'} ${log.recordId ?? ''} was updated.`,
      status: log.action === 'DELETE' ? 'WARNING' : 'INFO',
      referenceId: log.recordId ?? log.id,
      referenceType: log.recordType ?? 'AuditLog',
      organization: null,
      createdAt: log.createdAt,
      actor: log.user?.fullname ?? log.user?.email ?? 'System',
      actionLabel: null,
      actionRoute: null,
      metadata: { action: log.action, pageKey: log.pageKey, oldValue: log.oldValue, newValue: log.newValue },
    }))
  }

  const query = normalizeText(search).trim()
  const filtered = events
    .filter((event) => inDateRange(event.createdAt, dateRange))
    .filter((event) => !status || event.status === status)
    .filter((event) => enabledTypes.has(event.eventType))
    .filter((event) => !query || matchesSearch(event, query))
    .sort((a, b) =>
      sort === 'OLDEST'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    )

  const safeOffset = Math.max(offset ?? 0, 0)
  const safeLimit = Math.max(1, Math.min(limit ?? 30, 100))
  const page = filtered.slice(safeOffset, safeOffset + safeLimit)

  return {
    groups: groupEvents(page),
    totalCount: filtered.length,
    hasNextPage: safeOffset + safeLimit < filtered.length,
    summary: summarize(filtered),
  }
}
