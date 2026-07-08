import { arg, extendType, intArg, list, nonNull, nullable, stringArg } from 'nexus'
import { getSupplierOrderTimeline } from '../../../services/supplierTimeline.service.js'
import type { TimelineEventType, TimelineStatus, TimelineSort } from '../../../services/supplierTimeline.service.js'

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const SupplierOrderTimelineQuery = extendType({
  type: 'Query',
  definition(t) {
    t.nonNull.field('supplierOrderTimeline', {
      type: 'SupplierOrderTimelinePayload',
      args: {
        supplierOrgId: nonNull(intArg()),
        search: nullable(stringArg()),
        status: nullable(arg({ type: 'SupplierTimelineStatus' })),
        eventTypes: nullable(list(nonNull(arg({ type: 'SupplierTimelineEventType' })))),
        startDate: nullable(stringArg()),
        endDate: nullable(stringArg()),
        limit: nullable(intArg()),
        offset: nullable(intArg()),
        sort: nullable(arg({ type: 'SupplierTimelineSort' })),
      },
      resolve: async (_, args, ctx) => {
        return getSupplierOrderTimeline(ctx.prisma, {
          supplierOrgId: args.supplierOrgId,
          search: args.search,
          status: args.status as TimelineStatus | null,
          eventTypes: args.eventTypes as TimelineEventType[] | null,
          dateRange: {
            start: parseDate(args.startDate),
            end: parseDate(args.endDate),
          },
          limit: args.limit,
          offset: args.offset,
          sort: args.sort as TimelineSort | null,
        })
      },
    })
  },
})
