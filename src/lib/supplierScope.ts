import { requireAuth } from '../middleware/auth.middleware.js';
import type { Context } from './types.js';

function supplierOrgId(ctx: Context) {
  requireAuth(ctx);
  const orgId = Number(ctx.user?.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) throw new Error('Authentication required');
  return orgId;
}

export function requireSupplierOrganizationScope(ctx: Context, requestedOrgId: number) {
  const orgId = supplierOrgId(ctx);
  if (orgId !== Number(requestedOrgId)) throw new Error('Resource not found.');
  return orgId;
}

export async function requireSupplierCatalogScope(ctx: Context, catalogId: string) {
  const catalog = await ctx.prisma.supplierCatalog.findFirst({
    where: { id: catalogId, organizationId: supplierOrgId(ctx), deletedAt: null },
    select: { id: true },
  });
  if (!catalog) throw new Error('Resource not found.');
}

export async function requireSupplierItemScope(ctx: Context, supplierItemId: string) {
  const item = await ctx.prisma.supplierItem.findFirst({
    where: { id: supplierItemId, catalog: { organizationId: supplierOrgId(ctx), deletedAt: null } },
    select: { id: true },
  });
  if (!item) throw new Error('Resource not found.');
}

export async function requireSupplierVariantScope(ctx: Context, variantId: string) {
  const variant = await ctx.prisma.supplierItemVariant.findFirst({
    where: { id: variantId, supplierItem: { catalog: { organizationId: supplierOrgId(ctx), deletedAt: null } } },
    select: { id: true },
  });
  if (!variant) throw new Error('Resource not found.');
}

export async function requireSupplierVariantGroupScope(ctx: Context, groupId: string) {
  const group = await ctx.prisma.supplierItemVariantGroup.findFirst({
    where: { id: groupId, supplierItem: { catalog: { organizationId: supplierOrgId(ctx), deletedAt: null } } },
    select: { id: true },
  });
  if (!group) throw new Error('Resource not found.');
}

export async function requireSupplierVariantOptionScope(ctx: Context, optionId: string) {
  const option = await ctx.prisma.supplierItemVariantOption.findFirst({
    where: { id: optionId, variantGroup: { supplierItem: { catalog: { organizationId: supplierOrgId(ctx), deletedAt: null } } } },
    select: { id: true },
  });
  if (!option) throw new Error('Resource not found.');
}

export async function requireSupplierPurchaseOrderScope(ctx: Context, purchaseOrderId: string) {
  const po = await ctx.prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, supplierOrgId: supplierOrgId(ctx) },
    select: { id: true },
  });
  if (!po) throw new Error('Resource not found.');
}
