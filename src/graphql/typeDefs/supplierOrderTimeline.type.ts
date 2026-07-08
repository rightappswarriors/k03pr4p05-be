import { enumType, objectType } from 'nexus'

export const SupplierTimelineEventType = enumType({
  name: 'SupplierTimelineEventType',
  members: [
    'PURCHASE_ORDER',
    'DELIVERY',
    'WALLET',
    'MANDATE',
    'INVENTORY',
    'SYSTEM',
    'ORGANIZATION',
    'NOTIFICATION',
  ],
})

export const SupplierTimelineStatus = enumType({
  name: 'SupplierTimelineStatus',
  members: ['SUCCESS', 'WARNING', 'INFO', 'ERROR', 'PENDING'],
})

export const SupplierTimelineSort = enumType({
  name: 'SupplierTimelineSort',
  members: ['NEWEST', 'OLDEST'],
})

export const SupplierTimelineEvent = objectType({
  name: 'SupplierTimelineEvent',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.field('eventType', { type: 'SupplierTimelineEventType' })
    t.nonNull.string('title')
    t.nonNull.string('description')
    t.nonNull.field('status', { type: 'SupplierTimelineStatus' })
    t.nullable.string('referenceId')
    t.nullable.string('referenceType')
    t.nullable.string('organization')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nullable.string('actor')
    t.nonNull.string('icon')
    t.nonNull.string('color')
    t.nullable.string('actionLabel')
    t.nullable.string('actionRoute')
    t.nonNull.field('metadata', { type: 'Json' })
  },
})

export const SupplierTimelineGroup = objectType({
  name: 'SupplierTimelineGroup',
  definition(t) {
    t.nonNull.string('label')
    t.nonNull.list.nonNull.field('events', { type: 'SupplierTimelineEvent' })
  },
})

export const SupplierTimelineSummary = objectType({
  name: 'SupplierTimelineSummary',
  definition(t) {
    t.nonNull.int('total')
    t.nonNull.int('purchaseOrders')
    t.nonNull.int('deliveries')
    t.nonNull.int('wallet')
    t.nonNull.int('mandates')
    t.nonNull.int('inventory')
    t.nonNull.int('notifications')
    t.nonNull.int('attention')
  },
})

export const SupplierOrderTimelinePayload = objectType({
  name: 'SupplierOrderTimelinePayload',
  definition(t) {
    t.nonNull.list.nonNull.field('groups', { type: 'SupplierTimelineGroup' })
    t.nonNull.int('totalCount')
    t.nonNull.boolean('hasNextPage')
    t.nonNull.field('summary', { type: 'SupplierTimelineSummary' })
  },
})
