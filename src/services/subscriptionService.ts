
import { prisma } from '../lib/prisma.js';

export async function createSubscription(organizationId: number, plan: 'BASIC' | 'GOLD') {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SubscriptionService] Creating subscription for org ${organizationId}...`)
    }

    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findUnique({
      where: { orgId: organizationId }
    })

    if (existingSubscription) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SubscriptionService] Subscription already exists for org ${organizationId}`, existingSubscription)
      }
      return existingSubscription
    }

    const subscription = await prisma.subscription.create({
      data: {
        orgId: organizationId,
        plan,
        expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        features: { createdAt: new Date() },
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SubscriptionService] ✅ Subscription created:`, subscription)
    }

    return subscription
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[SubscriptionService] ❌ Error creating subscription:`, error)
    }
    throw error
  }
}

export async function updateSubscription(organizationId: number, plan: 'BASIC' | 'GOLD') {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SubscriptionService] Updating subscription for org ${organizationId}...`)
    }

    const subscription = await prisma.subscription.update({
      where: { orgId: organizationId },
      data: {
        plan,
        features: { updatedAt: new Date() },
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SubscriptionService] ✅ Subscription updated:`, subscription)
    }

    return subscription
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[SubscriptionService] ❌ Error updating subscription:`, error)
    }
    throw error
  }
}
