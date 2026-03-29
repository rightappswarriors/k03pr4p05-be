import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getAllOutletPromos = async () => {
  return await prisma.outletPromo.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const getOutletPromoById = async (id: number) => {
  return await prisma.outletPromo.findUnique({
    where: { id },
  });
};

export const getOutletPromosByOutletId = async (outletId: number) => {
  return await prisma.outletPromo.findMany({
    where: { outletId },
    orderBy: { createdAt: "desc" },
  });
};

export const getOutletPromosByPromoTypeId = async (promoTypeId: number) => {
  return await prisma.outletPromo.findMany({
    where: { promoTypeId },
    orderBy: { createdAt: "desc" },
  });
};

export const createOutletPromo = async (data: {
  outletId: number;
  promoTypeId: number;
  discount: number;
  isActive?: boolean;
  userId: number;
}) => {
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

export const updateOutletPromo = async (id: number, data: {
  discount?: number;
  isActive?: boolean;
}) => {
  return await prisma.outletPromo.update({
    where: { id },
    data: {
      ...data,
    },
  });
};

export const deleteOutletPromo = async (id: number) => {
  return await prisma.outletPromo.delete({
    where: { id },
  });
};
