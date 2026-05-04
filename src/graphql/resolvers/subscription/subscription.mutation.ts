import { extendType, intArg, nonNull, arg, nullable, stringArg } from 'nexus'
import { createSubscription as createSubscriptionService, updateSubscription as updateSubscriptionService } from '../../../services/subscriptionService.js'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'

export const subscriptionMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createSubscription', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
        plan: nonNull(arg({ type: 'SubscriptionPlan' }))
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Subscription] Creating subscription for orgId: ${orgId}, plan: ${plan}`)
        }
        try {
          const subscription = await createSubscriptionService(Number(orgId), plan)
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Subscription] ✅ Created subscription:`, subscription)
          }
          return subscription
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Subscription] ❌ Failed to create subscription:`, error)
          }
          throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    })
    t.field('updateSubscription', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
        plan: nonNull(arg({ type: 'SubscriptionPlan' }))
      },
      resolve: async (_, { orgId, plan }, ctx) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Subscription] Updating subscription for orgId: ${orgId}, plan: ${plan}`)
        }
        try {
          const subscription = await updateSubscriptionService(Number(orgId), plan)
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Subscription] ✅ Updated subscription:`, subscription)
          }
          return subscription
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Subscription] ❌ Failed to update subscription:`, error)
          }
          throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }),
     // ── Create subscription for an org (super admin) ──────────────────────────
    t.field('createSubscriptionAdmin', {
      type: 'Subscription',
      args: {
        orgId:     nonNull(intArg()),
        plan:      nonNull(arg({ type: 'SubscriptionPlan' })),
        expiresAt: nullable(stringArg()),   // ISO date string, nullable = no expiry
        features:  nullable(stringArg()),   // JSON string
      },
      resolve: async (_, { orgId, plan, expiresAt, features }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, 'ADMIN');

        // Upsert so calling it twice doesn't error
        return ctx.prisma.subscription.upsert({
          where: { orgId },
          create: {
            orgId,
            plan,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            features:  features  ? JSON.parse(features) : null,
          },
          update: {
            plan,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            features:  features  ? JSON.parse(features) : null,
          },
          include: { org: true },
        });
      },
    });

    // ── Update plan / expiry (super admin) ────────────────────────────────────
    t.field('updateSubscriptionAdmin', {
      type: 'Subscription',
      args: {
        orgId:     nonNull(intArg()),
        plan:      nullable(arg({ type: 'SubscriptionPlan' })),
        expiresAt: nullable(stringArg()),
        features:  nullable(stringArg()),
      },
      resolve: async (_, { orgId, plan, expiresAt, features }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, 'ADMIN');

        return ctx.prisma.subscription.update({
          where: { orgId },
          data: {
            ...(plan      ? { plan }                          : {}),
            ...(expiresAt !== undefined
              ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
              : {}),
            ...(features !== undefined
              ? { features: features ? JSON.parse(features) : null }
              : {}),
          },
          include: { org: true },
        });
      },
    });

    // ── Revoke / delete subscription (super admin) ────────────────────────────
    t.field('deleteSubscriptionAdmin', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
      },
      resolve: async (_, { orgId }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, 'ADMIN');

        return ctx.prisma.subscription.delete({
          where: { orgId },
          include: { org: true },
        });
      },
    });

    // ── Extend expiry by N days (super admin convenience) ─────────────────────
    t.field('extendSubscriptionAdmin', {
      type: 'Subscription',
      args: {
        orgId: nonNull(intArg()),
        days:  nonNull(intArg()),
      },
      resolve: async (_, { orgId, days }, ctx) => {
        requireAuth(ctx);
        requireRole(ctx, 'ADMIN');

        const existing = await ctx.prisma.subscription.findUnique({
          where: { orgId },
        });

        if (!existing) throw new Error(`No subscription found for org ${orgId}`);

        const base = existing.expiresAt && existing.expiresAt > new Date()
          ? existing.expiresAt   // extend from current expiry if still active
          : new Date();           // start fresh from today if already expired

        const newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + days);

        return ctx.prisma.subscription.update({
          where: { orgId },
          data: { expiresAt: newExpiry },
          include: { org: true },
        });
      },
    });
  }
})