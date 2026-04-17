import { prisma } from '../lib/prisma.js';
export const getAllPromoTypes = async (orgId) => {
    return await prisma.promoType.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
    });
};
export const getPromoTypeById = async (id, orgId) => {
    return await prisma.promoType.findUnique({
        where: { id, orgId },
    });
};
export const getPromoTypesByOrg = async (orgId) => {
    return await prisma.promoType.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
    });
};
export const createPromoType = async (data) => {
    return await prisma.promoType.create({
        data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive ?? true,
            orgId: data.orgId,
            userId: data.userId ?? null,
        },
    });
};
export const updatePromoType = async (id, orgId, data) => {
    return await prisma.promoType.update({
        where: { id, orgId },
        data,
    });
};
export const deletePromoType = async (id, orgId) => {
    return await prisma.promoType.delete({
        where: { id, orgId },
    });
};
