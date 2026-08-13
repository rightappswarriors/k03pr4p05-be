import { extendType, intArg, nonNull, stringArg, arg } from 'nexus';

const assertUser = (ctx: any) => { if (!ctx.user?.orgId) throw new Error('Authentication and an organization are required.'); return ctx.user; };
const assertLinkAccess = async (ctx: any, id: string) => {
  const user = assertUser(ctx);
  const link = await ctx.prisma.supplierOutletLink.findFirst({ where: { id, deletedAt: null }, include: { outlet: true } });
  if (!link || (link.supplierOrgId !== user.orgId && link.outlet.orgId !== user.orgId)) throw new Error('Supplier link not found.');
  return link;
};
const workspace = async (ctx: any, link: any, perspective: 'supplier' | 'retailer') => {
  const outlet = link.outlet ?? await ctx.prisma.outlet.findUnique({ where: { id: link.outletId }, include: { org: true } });
  const organization = perspective === 'supplier' ? outlet.org : await ctx.prisma.organization.findUnique({ where: { id: link.supplierOrgId } });
  const orders = await ctx.prisma.purchaseOrder.findMany({ where: { supplierOrgId: link.supplierOrgId, outletId: link.outletId }, select: { totalAmount: true, status: true, updatedAt: true } });
  const revenue = orders.reduce((sum: number, order: any) => sum + (order.status === 'DELIVERED' ? order.totalAmount : 0), 0);
  const outstanding = orders.reduce((sum: number, order: any) => sum + (['PENDING', 'ACCEPTED', 'PROCESSING'].includes(order.status) ? order.totalAmount : 0), 0);
  const lastActivity = orders.reduce((latest: Date | null, order: any) => !latest || order.updatedAt > latest ? order.updatedAt : latest, null);
  return { ...link, organizationName: organization?.name ?? outlet.name, organizationLogo: organization?.profileImg ?? organization?.profilePhoto ?? null, rating: 0, revenue, orders: orders.length, outstanding, openMandates: 0, unreadMessages: 0, lastActivity, assignedAgentName: link.assignedAgent?.fullname ?? null };
};

export const SupplierLinkQuery = extendType({
  type: 'Query', definition(t) {
    t.nonNull.list.nonNull.field('supplierLinks', {
      type: 'SupplierLinkWorkspace', args: { status: arg({ type: 'SupplierLinkStatus' }) }, resolve: async (_, { status }, ctx) => {
        const user = assertUser(ctx);
        // Returns retailer relationships for the current supplier organization.
        const links = await ctx.prisma.supplierOutletLink.findMany({ where: { supplierOrgId: user.orgId, deletedAt: null, ...(status ? { status } : {}) }, include: { outlet: { include: { org: true } }, assignedAgent: true }, orderBy: { updatedAt: 'desc' } });
        return Promise.all(links.map((link: any) => workspace(ctx, link, 'supplier')));
      }
    });
    t.nonNull.list.nonNull.field('retailerSupplierLinks', {
      type: 'SupplierLinkWorkspace', resolve: async (_, __, ctx) => {
        const user = assertUser(ctx);
        // Returns supplier relationships connected to the current retailer organization.
        const links = await ctx.prisma.supplierOutletLink.findMany({ where: { outlet: { orgId: user.orgId }, deletedAt: null }, include: { outlet: { include: { org: true } }, assignedAgent: true }, orderBy: { updatedAt: 'desc' } });
        return Promise.all(links.map((link: any) => workspace(ctx, link, 'retailer')));
      }
    });
    t.nullable.field('supplierLink', {
      type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => {
        // Returns one relationship workspace when the user belongs to either organization.
        const link = await assertLinkAccess(ctx, id); return workspace(ctx, await ctx.prisma.supplierOutletLink.findUnique({ where: { id: link.id }, include: { outlet: { include: { org: true } }, assignedAgent: true } }), link.supplierOrgId === ctx.user.orgId ? 'supplier' : 'retailer');
      }
    });
  }
});

export const SupplierLinkMutation = extendType({
  type: 'Mutation', definition(t) {
    t.nonNull.field('createSupplierLink', {
      type: 'SupplierLinkWorkspace', args: { outletId: nonNull(intArg()) }, resolve: async (_, { outletId }, ctx) => {
        const user = assertUser(ctx); const outlet = await ctx.prisma.outlet.findUnique({ where: { id: outletId }, include: { org: true } }); if (!outlet) throw new Error('Outlet not found.');
        // Creates a supplier relationship request for a retailer outlet.
        const link = await ctx.prisma.supplierOutletLink.upsert({ where: { supplierOrgId_outletId: { supplierOrgId: user.orgId, outletId } }, create: { supplierOrgId: user.orgId, outletId, status: 'REQUESTED' }, update: { status: 'REQUESTED', deletedAt: null }, include: { outlet: { include: { org: true } }, assignedAgent: true } });
        return workspace(ctx, link, 'supplier');
      }
    });
    t.nonNull.field('updateSupplierLink', {
      type: 'SupplierLinkWorkspace', args: { input: nonNull(arg({ type: 'UpdateSupplierLinkInput' })) }, resolve: async (_, { input }, ctx) => {
        const current = await assertLinkAccess(ctx, input.id); const user = ctx.user;
        // Updates lifecycle and collaboration settings for an authorized relationship.
        const data: any = { ...input }; delete data.id;
        if (input.status === 'ACTIVE' || input.status === 'ACCEPTED') { data.isApproved = true; data.linkedAt = current.linkedAt ?? new Date(); }
        if (input.status === 'PAUSED') data.pausedAt = new Date(); if (input.status === 'ARCHIVED') data.archivedAt = new Date();
        const link = await ctx.prisma.$transaction(async (tx: any) => { const updated = await tx.supplierOutletLink.update({ where: { id: input.id }, data, include: { outlet: { include: { org: true } }, assignedAgent: true } }); await tx.auditLog.create({ data: { orgId: user.orgId, userId: user.id, pageKey: 'supplierLinksPage', action: 'STATUS_CHANGE', recordId: updated.id, recordType: 'SupplierOutletLink', newValue: data } }); return updated; });
        return workspace(ctx, link, current.supplierOrgId === user.orgId ? 'supplier' : 'retailer');
      }
    });
  }
});
