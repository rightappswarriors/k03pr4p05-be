import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getAllPromoTypes = async () => {
  return await prisma.promoType.findMany({
    orderBy: { createdAt: "desc" },
  });
};

export const getPromoTypeById = async (id: number) => {
  return await prisma.promoType.findUnique({
    where: { id },
  });
};

export const getPromoTypesByOrg = async (orgId: number) => {
  return await prisma.promoType.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
};

export const createPromoType = async (data: {
  name: string;
  description?: string;
  isActive?: boolean;
  orgId: number;
  userId?: number;
}) => {
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

export const updatePromoType = async (id: number, data: { name?: string; description?: string; isActive?: boolean }) => {
  return await prisma.promoType.update({
    where: { id },
    data,
  });
};

export const deletePromoType = async (id: number) => {
  return await prisma.promoType.delete({
    where: { id },
  });
};
