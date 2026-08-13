import { arg, extendType, intArg, nonNull, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
export const subscriptionQuery = extendType({
    type: 'Query',
    definition(t) {
        t.field('subscription', {
            type: 'Subscription',
            args: { orgId: intArg() },
            resolve: async (_, { orgId }, ctx) => {
                return ctx.prisma.subscription.findUnique({ where: { orgId } });
            }
        }),
            t.field('getAllSubscriptions', {
                type: 'SubscriptionList',
                args: {
                    query: stringArg(), // search by org name
                    plan: arg({ type: 'SubscriptionPlan' }),
                    page: intArg(),
                    pageSize: intArg(),
                },
                resolve: async (_, { query, plan, page = 1, pageSize = 20 }, ctx) => {
                    requireAuth(ctx);
                    requireRole(ctx, 'ADMIN');
                    const skip = (page - 1) * pageSize;
                    const where = {
                        ...(plan ? { plan } : {}),
                        ...(query
                            ? { org: { name: { contains: query, mode: 'insensitive' } } }
                            : {}),
                    };
                    const [items, total] = await ctx.prisma.$transaction([
                        ctx.prisma.subscription.findMany({
                            where,
                            include: { org: true },
                            skip,
                            take: pageSize,
                            orderBy: { createdAt: 'desc' },
                        }),
                        ctx.prisma.subscription.count({ where }),
                    ]);
                    return { items, total, page, pageSize };
                },
            });
        // ── Get single subscription by orgId ─────────────────────────────────────
        t.field('getSubscriptionByOrgId', {
            type: 'Subscription',
            args: {
                orgId: nonNull(intArg()),
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, 'ADMIN');
                return ctx.prisma.subscription.findUnique({
                    where: { orgId },
                    include: { org: true },
                });
            },
        });
        // ── Get own org subscription (org owner/admin) ────────────────────────────
        t.field('getMySubscription', {
            type: 'Subscription',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user.orgId);
                return ctx.prisma.subscription.findUnique({
                    where: { orgId },
                    include: { org: true },
                });
            },
        });
    }
});
