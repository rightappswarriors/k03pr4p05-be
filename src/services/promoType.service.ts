
import { prisma } from '../lib/prisma.js';

export const getAllPromoTypes = async (orgId: number) => {
  return await prisma.promoType.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
};

export const getPromoTypeById = async (id: number, orgId: number) => {
  return await prisma.promoType.findUnique({
    where: { id, orgId },
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

export const updatePromoType = async (id: number, orgId: number, data: { name?: string; description?: string; isActive?: boolean }) => {
  return await prisma.promoType.update({
    where: { id, orgId },
    data,
  });
};

export const deletePromoType = async (id: number, orgId: number) => {
  return await prisma.promoType.update({
    where: { id, orgId },
    data: { deletedAt: new Date() },
  });
};
