import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export async function createOrganization(userId, name) {
    const organization = await prisma.organization.create({
        data: {
            name,
        },
    });
    await prisma.user.update({
        where: { id: userId },
        data: {
            orgId: organization.id,
        },
    });
    return organization;
}
