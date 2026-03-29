import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export async function createSubscription(organizationId, plan) {
    const subscription = await prisma.subscription.create({
        data: {
            orgId: organizationId,
            plan,
            expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            features: { createdAt: new Date() },
        },
    });
    return subscription;
}
export async function updateSubscription(organizationId, plan) {
    const subscription = await prisma.subscription.update({
        where: { orgId: organizationId },
        data: {
            plan,
            features: { updatedAt: new Date() },
        },
    });
    return subscription;
}
