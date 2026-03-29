import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export const getAllOutletPromos = async () => {
    return await prisma.outletPromo.findMany({
        orderBy: { createdAt: "desc" },
    });
};
export const getOutletPromoById = async (id) => {
    return await prisma.outletPromo.findUnique({
        where: { id },
    });
};
export const getOutletPromosByOutletId = async (outletId) => {
    return await prisma.outletPromo.findMany({
        where: { outletId },
        orderBy: { createdAt: "desc" },
    });
};
export const getOutletPromosByPromoTypeId = async (promoTypeId) => {
    return await prisma.outletPromo.findMany({
        where: { promoTypeId },
        orderBy: { createdAt: "desc" },
    });
};
export const createOutletPromo = async (data) => {
    return await prisma.outletPromo.create({
        data: {
            outletId: data.outletId,
            promoTypeId: data.promoTypeId,
            discount: data.discount,
            isActive: data.isActive ?? true,
            userId: data.userId,
        },
    });
};
export const updateOutletPromo = async (id, data) => {
    return await prisma.outletPromo.update({
        where: { id },
        data: {
            ...data,
        },
    });
};
export const deleteOutletPromo = async (id) => {
    return await prisma.outletPromo.delete({
        where: { id },
    });
};
