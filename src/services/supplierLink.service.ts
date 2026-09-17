import type { Context } from '../lib/types.js';
import { persistBusinessNotification, publishBusinessNotification } from './notification.service.js';

export type CanonicalSupplierLinkStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
export type SupplierLinkAction = 'APPROVE' | 'REJECT' | 'DISABLE';

const STATUS_GROUPS: Record<CanonicalSupplierLinkStatus, string[]> = {
  PENDING: ['SUGGESTED', 'REQUESTED', 'PENDING'],
  APPROVED: ['ACCEPTED', 'ACTIVE', 'APPROVED'],
  REJECTED: ['BLOCKED', 'REJECTED'],
  DISABLED: ['PAUSED', 'ARCHIVED', 'DISABLED'],
};

export function canonicalSupplierLinkStatus(status: string): CanonicalSupplierLinkStatus {
  for (const [canonical, values] of Object.entries(STATUS_GROUPS)) {
    if (values.includes(status)) return canonical as CanonicalSupplierLinkStatus;
  }
  throw new Error('Unsupported supplier link status.');
}

export function supplierLinkStatusValues(status?: CanonicalSupplierLinkStatus | null) {
  return status ? STATUS_GROUPS[status] : undefined;
}

export function isSupplierLinkTransitionAllowed(current: string, action: SupplierLinkAction) {
  const currentStatus = canonicalSupplierLinkStatus(current);
  const target: CanonicalSupplierLinkStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DISABLED';
  if (currentStatus === target) return true;
  return action === 'DISABLE' ? currentStatus === 'APPROVED' : currentStatus === 'PENDING';
}

export function normalizeSupplierLinkPage(page?: number | null, pageSize?: number | null) {
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = pageSize ?? 20;
  if (![20, 50, 100].includes(safePageSize)) {
    throw new Error('Page size must be 20, 50, or 100.');
  }
  return { page: safePage, pageSize: safePageSize, skip: (safePage - 1) * safePageSize };
}

export function supplierLinkOrderBy(sortBy?: string | null, sortDirection?: string | null) {
  const direction = sortDirection === 'ASC' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'STATUS': return { status: direction };
    case 'RETAILER_NAME': return { outlet: { org: { name: direction } } };
    case 'OUTLET_NAME': return { outlet: { name: direction } };
    case 'REQUESTED_AT':
    case undefined:
    case null:
      return { requestedAt: direction };
    default: throw new Error('Unsupported supplier link sort field.');
  }
}

export async function requireRetailerOrganization(ctx: Context) {
  if (!ctx.user?.orgId) throw new Error('Authentication and a Retailer organization are required.');
  const organization = await ctx.prisma.organization.findFirst({
    where: { id: ctx.user.orgId, roles: { has: 'SELLER' }, deletedAt: null, accountStatus: 'ACTIVE' },
    select: { id: true },
  });
  if (!organization) throw new Error('Retailer organization not found.');
  return organization.id;
}

export async function requireSupplierOrganization(ctx: Context) {
  if (!ctx.user?.orgId) throw new Error('Authentication and a Supplier organization are required.');
  const organization = await ctx.prisma.organization.findFirst({
    where: { id: ctx.user.orgId, roles: { has: 'SUPPLIER' }, deletedAt: null, accountStatus: 'ACTIVE' },
    select: { id: true },
  });
  if (!organization) throw new Error('Supplier organization not found.');
  return organization.id;
}

export async function requireRetailerOutlet(ctx: Context, outletId: number) {
  const retailerOrgId = await requireRetailerOrganization(ctx);
  const outlet = await ctx.prisma.outlet.findFirst({
    where: { id: outletId, orgId: retailerOrgId, deletedAt: null, isActive: true },
    include: { org: true },
  });
  if (!outlet) throw new Error('Retailer outlet not found.');
  return outlet;
}

export async function requireSupplierLinkForReview(ctx: Context, id: string) {
  const supplierOrgId = await requireSupplierOrganization(ctx);
  const link = await ctx.prisma.supplierOutletLink.findFirst({
    where: { id, supplierOrgId, deletedAt: null },
    include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
  });
  if (!link) throw new Error('Supplier link not found.');
  return link;
}

export async function hasApprovedSupplierRetailerLink(
  prisma: any,
  input: { supplierOrgId: number; retailerOrgId?: number; outletId?: number },
) {
  if (!input.retailerOrgId && !input.outletId) throw new Error('A Retailer organization or outlet is required.');
  const link = await prisma.supplierOutletLink.findFirst({
    where: {
      supplierOrgId: input.supplierOrgId,
      deletedAt: null,
      isApproved: true,
      status: { in: STATUS_GROUPS.APPROVED },
      ...(input.outletId ? { outletId: input.outletId } : { outlet: { orgId: input.retailerOrgId } }),
    },
    select: { id: true },
  });
  return Boolean(link);
}

export async function requireApprovedSupplierRetailerLink(
  prisma: any,
  input: { supplierOrgId: number; retailerOrgId?: number; outletId?: number },
) {
  if (!(await hasApprovedSupplierRetailerLink(prisma, input))) {
    throw new Error('An approved Supplier and Retailer relationship is required.');
  }
}

export async function requestCanonicalSupplierLink(ctx: Context, supplierOrgId: number, outletId: number) {
  const outlet = await requireRetailerOutlet(ctx, outletId);
  if (supplierOrgId === outlet.orgId) throw new Error('An organization cannot link to itself.');
  const supplier = await ctx.prisma.organization.findFirst({
    where: { id: supplierOrgId, roles: { has: 'SUPPLIER' }, deletedAt: null, accountStatus: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error('Supplier organization not found.');

  let notification: any = null;
  const result = await ctx.prisma.$transaction(async (tx) => {
    const prior = await tx.supplierOutletLink.findUnique({
      where: { supplierOrgId_outletId: { supplierOrgId, outletId } },
      select: { status: true },
    });
    const existing = await tx.supplierOutletLink.upsert({
      where: { supplierOrgId_outletId: { supplierOrgId, outletId } },
      create: {
        supplierOrgId,
        outletId,
        status: 'PENDING',
        isApproved: false,
        requestedAt: new Date(),
        requestedById: ctx.user!.id,
      },
      update: {},
    });
    const currentStatus = canonicalSupplierLinkStatus(existing.status);
    const isNewRequest = !prior || ['REJECTED', 'DISABLED'].includes(canonicalSupplierLinkStatus(prior.status));
    if (isNewRequest) {
      const persisted = await persistBusinessNotification(tx, {
        orgId: supplierOrgId,
        outletId,
        type: 'NEW_TRANSACTION',
        title: 'Supplier link requested',
        message: `${outlet.org.name} requested a Supplier link for ${outlet.name}.`,
        referenceType: 'SUPPLIER_LINK',
        referenceId: existing.id,
      });
      if (persisted.created) notification = persisted.notification;
    }
    if (currentStatus === 'PENDING' || currentStatus === 'APPROVED') {
      return tx.supplierOutletLink.findUnique({
        where: { id: existing.id },
        include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
      });
    }
    return tx.supplierOutletLink.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING', isApproved: false, deletedAt: null,
        requestedAt: new Date(), requestedById: ctx.user!.id,
        approvedAt: null, rejectedAt: null, disabledAt: null, reviewedById: null,
      },
      include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
    });
  });
  publishBusinessNotification(notification);
  return result;
}

export async function transitionSupplierLink(ctx: Context, id: string, action: SupplierLinkAction) {
  const current = await requireSupplierLinkForReview(ctx, id);
  const target: CanonicalSupplierLinkStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'DISABLED';
  const allowed = action === 'DISABLE' ? STATUS_GROUPS.APPROVED : STATUS_GROUPS.PENDING;
  const currentStatus = canonicalSupplierLinkStatus(current.status);
  if (currentStatus === target) return current;
  if (action !== 'DISABLE' && current.requestedById) {
    const requester = await ctx.prisma.user.findUnique({ where: { id: current.requestedById }, select: { orgId: true } });
    if (requester?.orgId === current.supplierOrgId) throw new Error('The Retailer must review this Supplier invitation.');
  }
  if (!isSupplierLinkTransitionAllowed(current.status, action)) throw new Error(`A ${currentStatus.toLowerCase()} link cannot be ${action.toLowerCase()}d.`);
  const now = new Date();
  const data = action === 'APPROVE'
    ? { status: 'APPROVED', isApproved: true, approvedAt: now, rejectedAt: null, disabledAt: null, reviewedById: ctx.user!.id, linkedAt: current.linkedAt ?? now }
    : action === 'REJECT'
      ? { status: 'REJECTED', isApproved: false, rejectedAt: now, approvedAt: null, disabledAt: null, reviewedById: ctx.user!.id }
      : { status: 'DISABLED', isApproved: false, disabledAt: now, reviewedById: ctx.user!.id };

  let notification: any = null;
  const result = await ctx.prisma.$transaction(async (tx) => {
    const changed = await tx.supplierOutletLink.updateMany({
      where: { id, supplierOrgId: current.supplierOrgId, deletedAt: null, status: { in: allowed as any } },
      data: data as any,
    });
    const updated = await tx.supplierOutletLink.findFirst({
      where: { id, supplierOrgId: current.supplierOrgId, deletedAt: null },
      include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
    });
    if (!updated) throw new Error('Supplier link not found.');
    if (changed.count === 0 && canonicalSupplierLinkStatus(updated.status) !== target) {
      throw new Error('The relationship changed while this action was being processed. Refresh and try again.');
    }
    if (changed.count > 0) {
      await tx.auditLog.create({
        data: {
          orgId: current.supplierOrgId,
          userId: ctx.user!.id,
          pageKey: 'supplierLinksPage',
          action: 'STATUS_CHANGE',
          recordId: id,
          recordType: 'SupplierOutletLink',
          oldValue: { status: currentStatus },
          newValue: { status: target },
        },
      });
      if (action === 'APPROVE' || action === 'REJECT') {
        const persisted = await persistBusinessNotification(tx, {
          orgId: current.outlet.orgId,
          outletId: current.outletId,
          type: 'NEW_TRANSACTION',
          title: action === 'APPROVE' ? 'Supplier link approved' : 'Supplier link rejected',
          message: `${current.supplierOrg.name} ${action === 'APPROVE' ? 'approved' : 'rejected'} the Supplier link for ${current.outlet.name}.`,
          referenceType: 'SUPPLIER_LINK',
          referenceId: current.id,
        });
        if (persisted.created) notification = persisted.notification;
      }
    }
    return updated;
  });
  publishBusinessNotification(notification);
  return result;
}

export async function transitionSupplierInvitation(ctx: Context, id: string, action: 'ACCEPT' | 'REJECT') {
  const retailerOrgId = await requireRetailerOrganization(ctx);
  const current = await ctx.prisma.supplierOutletLink.findFirst({
    where: { id, deletedAt: null, outlet: { orgId: retailerOrgId } },
    include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
  });
  if (!current) throw new Error('Supplier link not found.');
  const target: CanonicalSupplierLinkStatus = action === 'ACCEPT' ? 'APPROVED' : 'REJECTED';
  const currentStatus = canonicalSupplierLinkStatus(current.status);
  if (currentStatus === target) return current;
  if (currentStatus !== 'PENDING' || !current.requestedById) throw new Error('This relationship is not a pending Supplier invitation.');
  const requester = await ctx.prisma.user.findUnique({ where: { id: current.requestedById }, select: { orgId: true } });
  if (requester?.orgId !== current.supplierOrgId) throw new Error('This relationship is not a Supplier invitation.');
  const now = new Date();
  const data = action === 'ACCEPT'
    ? { status: 'APPROVED', isApproved: true, approvedAt: now, rejectedAt: null, reviewedById: ctx.user!.id, linkedAt: current.linkedAt ?? now }
    : { status: 'REJECTED', isApproved: false, rejectedAt: now, approvedAt: null, reviewedById: ctx.user!.id };
  return ctx.prisma.$transaction(async (tx) => {
    const changed = await tx.supplierOutletLink.updateMany({ where: { id, outlet: { orgId: retailerOrgId }, status: { in: STATUS_GROUPS.PENDING as any }, deletedAt: null }, data: data as any });
    const updated = await tx.supplierOutletLink.findFirst({ where: { id, outlet: { orgId: retailerOrgId }, deletedAt: null }, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true } });
    if (!updated) throw new Error('Supplier link not found.');
    if (changed.count === 0 && canonicalSupplierLinkStatus(updated.status) !== target) throw new Error('The relationship changed while this action was being processed. Refresh and try again.');
    if (changed.count > 0) await tx.auditLog.create({ data: { orgId: retailerOrgId, userId: ctx.user!.id, pageKey: 'supplierLinksPage', action: 'STATUS_CHANGE', recordId: id, recordType: 'SupplierOutletLink', oldValue: { status: currentStatus }, newValue: { status: target } } });
    return updated;
  });
}
