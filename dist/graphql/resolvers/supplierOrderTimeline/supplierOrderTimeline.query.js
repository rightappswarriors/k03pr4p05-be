import { arg, extendType, intArg, list, nonNull, nullable, stringArg } from 'nexus';
import { getSupplierOrderTimeline } from '../../../services/supplierTimeline.service.js';
function parseDate(value) {
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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
                    status: args.status,
                    eventTypes: args.eventTypes,
                    dateRange: {
                        start: parseDate(args.startDate),
                        end: parseDate(args.endDate),
                    },
                    limit: args.limit,
                    offset: args.offset,
                    sort: args.sort,
                });
            },
        });
    },
});
