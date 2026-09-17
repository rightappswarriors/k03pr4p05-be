import { extendType, intArg, nonNull, stringArg, arg } from 'nexus';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { getRegisteredSupplierProfile } from '../../../services/supplierBusinessProfile.service.js';
import { canonicalSupplierLinkStatus, normalizeSupplierLinkPage, requestCanonicalSupplierLink, requireRetailerOrganization, requireRetailerOutlet, requireSupplierOrganization, supplierLinkOrderBy, supplierLinkStatusValues, transitionSupplierInvitation, transitionSupplierLink, } from '../../../services/supplierLink.service.js';
const assertUser = (ctx) => { if (!ctx.user?.orgId)
    throw new Error('Authentication and an organization are required.'); return ctx.user; };
const assertLinkAccess = async (ctx, id) => {
    const user = assertUser(ctx);
    const link = await ctx.prisma.supplierOutletLink.findFirst({ where: { id, deletedAt: null }, include: { outlet: true } });
    if (!link || (link.supplierOrgId !== user.orgId && link.outlet.orgId !== user.orgId))
        throw new Error('Supplier link not found.');
    return link;
};
const workspace = async (ctx, link, perspective) => {
    const outlet = link.outlet ?? await ctx.prisma.outlet.findUnique({ where: { id: link.outletId }, include: { org: true } });
    const supplier = link.supplierOrg ?? await ctx.prisma.organization.findUnique({ where: { id: link.supplierOrgId } });
    const requester = link.requestedById ? await ctx.prisma.user.findUnique({ where: { id: link.requestedById }, select: { orgId: true } }) : null;
    const organization = perspective === 'supplier' ? outlet.org : supplier;
    const orders = await ctx.prisma.purchaseOrder.findMany({ where: { supplierOrgId: link.supplierOrgId, deliveryOutletId: link.outletId }, select: { totalAmount: true, status: true, updatedAt: true } });
    const revenue = orders.reduce((sum, order) => sum + (order.status === 'DELIVERED' ? order.totalAmount : 0), 0);
    const outstanding = orders.reduce((sum, order) => sum + (['PENDING', 'ACCEPTED', 'PROCESSING'].includes(order.status) ? order.totalAmount : 0), 0);
    const lastActivity = orders.reduce((latest, order) => !latest || order.updatedAt > latest ? order.updatedAt : latest, null);
    return {
        ...link,
        status: canonicalSupplierLinkStatus(link.status),
        requestedAt: link.requestedAt ?? link.createdAt,
        requestDirection: requester?.orgId === link.supplierOrgId ? 'SUPPLIER_TO_RETAILER' : 'RETAILER_TO_SUPPLIER',
        supplierName: supplier?.name ?? 'Supplier organization',
        supplierProfileImage: supplier?.profileImg ?? supplier?.profilePhoto ?? null,
        supplierLocation: supplier?.location ?? null,
        outletName: outlet.name,
        outletAddress: outlet.address ?? null,
        retailerOrganizationName: outlet.org?.name ?? outlet.name,
        retailerProfileImage: outlet.org?.profileImg ?? outlet.org?.profilePhoto ?? null,
        retailerLocation: outlet.org?.location ?? outlet.address ?? null,
        retailerContactNumber: outlet.org?.contactNumber ?? outlet.phone ?? null,
        retailerOrganization: {
            id: outlet.orgId,
            name: outlet.org?.name ?? outlet.name,
            profileImage: outlet.org?.profileImg ?? outlet.org?.profilePhoto ?? null,
            location: outlet.org?.location ?? outlet.address ?? null,
            contactNumber: outlet.org?.contactNumber ?? outlet.phone ?? null,
        },
        organizationName: organization?.name ?? outlet.name,
        organizationLogo: organization?.profileImg ?? organization?.profilePhoto ?? null,
        rating: null, revenue, orders: orders.length, outstanding, openMandates: 0,
        unreadMessages: 0, lastActivity, assignedAgentName: link.assignedAgent?.fullname ?? null,
    };
};
const relationshipWhere = (base, status, search) => ({
    ...base,
    deletedAt: null,
    ...(status ? { status: { in: supplierLinkStatusValues(canonicalSupplierLinkStatus(status)) } } : {}),
    ...(search?.trim() ? {
        OR: [
            { outlet: { name: { contains: search.trim(), mode: 'insensitive' } } },
            { outlet: { org: { name: { contains: search.trim(), mode: 'insensitive' } } } },
        ],
    } : {}),
});
const relationshipSummary = async (ctx, base, perspective = 'supplier') => {
    const rows = await ctx.prisma.supplierOutletLink.findMany({
        where: { ...base, deletedAt: null }, select: { status: true, supplierOrgId: true, outlet: { select: { orgId: true } } },
    });
    const count = (status) => rows.filter((row) => canonicalSupplierLinkStatus(row.status) === status).length;
    const approved = rows.filter((row) => canonicalSupplierLinkStatus(row.status) === 'APPROVED');
    return {
        activeRetailers: new Set(approved.map((row) => perspective === 'supplier' ? row.outlet.orgId : row.supplierOrgId)).size,
        pendingRequests: count('PENDING'), rejectedRequests: count('REJECTED'), disabledLinks: count('DISABLED'),
    };
};
export const SupplierLinkQuery = extendType({
    type: 'Query', definition(t) {
        t.nonNull.field('supplierLinkRelationships', {
            type: 'SupplierLinkPage',
            args: {
                status: arg({ type: 'SupplierLinkStatus' }), search: stringArg(), page: intArg(), pageSize: intArg(),
                sortBy: arg({ type: 'SupplierLinkSortField' }), sortDirection: arg({ type: 'SupplierLinkSortDirection' }),
            },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.view(ctx);
                const supplierOrgId = await requireSupplierOrganization(ctx);
                const { page, pageSize, skip } = normalizeSupplierLinkPage(args.page, args.pageSize);
                const where = relationshipWhere({ supplierOrgId }, args.status, args.search);
                const [links, total, summary] = await Promise.all([
                    ctx.prisma.supplierOutletLink.findMany({
                        where, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
                        orderBy: supplierLinkOrderBy(args.sortBy, args.sortDirection), skip, take: pageSize,
                    }),
                    ctx.prisma.supplierOutletLink.count({ where }),
                    relationshipSummary(ctx, { supplierOrgId }),
                ]);
                return { items: await Promise.all(links.map((link) => workspace(ctx, link, 'supplier'))), total, page, pageSize, summary };
            },
        });
        t.nonNull.field('retailerSupplierLinkRelationships', {
            type: 'SupplierLinkPage',
            args: {
                status: arg({ type: 'SupplierLinkStatus' }), search: stringArg(), page: intArg(), pageSize: intArg(),
                sortBy: arg({ type: 'SupplierLinkSortField' }), sortDirection: arg({ type: 'SupplierLinkSortDirection' }),
            },
            resolve: async (_, args, ctx) => {
                const retailerOrgId = await requireRetailerOrganization(ctx);
                const { page, pageSize, skip } = normalizeSupplierLinkPage(args.page, args.pageSize);
                const base = { outlet: { orgId: retailerOrgId } };
                const where = relationshipWhere(base, args.status, args.search);
                const [links, total, summary] = await Promise.all([
                    ctx.prisma.supplierOutletLink.findMany({
                        where, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true },
                        orderBy: supplierLinkOrderBy(args.sortBy, args.sortDirection), skip, take: pageSize,
                    }),
                    ctx.prisma.supplierOutletLink.count({ where }),
                    relationshipSummary(ctx, base, 'retailer'),
                ]);
                return { items: await Promise.all(links.map((link) => workspace(ctx, link, 'retailer'))), total, page, pageSize, summary };
            },
        });
        t.nonNull.field('registeredSupplierDirectory', {
            type: 'SupplierLinkDirectoryPage',
            args: { search: stringArg(), outletId: intArg(), page: intArg(), pageSize: intArg() },
            resolve: async (_, args, ctx) => {
                const retailerOrgId = await requireRetailerOrganization(ctx);
                if (args.outletId != null)
                    await requireRetailerOutlet(ctx, args.outletId);
                const { page, pageSize, skip } = normalizeSupplierLinkPage(args.page, args.pageSize);
                const where = {
                    roles: { has: 'SUPPLIER' }, deletedAt: null, accountStatus: 'ACTIVE', id: { not: retailerOrgId },
                    ...(args.search?.trim() ? { name: { contains: args.search.trim(), mode: 'insensitive' } } : {}),
                };
                const [organizations, total, outlets, links] = await Promise.all([
                    ctx.prisma.organization.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize, select: { id: true, name: true, profileImg: true, profilePhoto: true, location: true, contactNumber: true } }),
                    ctx.prisma.organization.count({ where }),
                    ctx.prisma.outlet.findMany({ where: { orgId: retailerOrgId, deletedAt: null, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, address: true } }),
                    args.outletId == null ? Promise.resolve([]) : ctx.prisma.supplierOutletLink.findMany({ where: { outletId: args.outletId, deletedAt: null }, select: { id: true, supplierOrgId: true, status: true } }),
                ]);
                const linkBySupplier = new Map(links.map((link) => [link.supplierOrgId, { id: link.id, status: canonicalSupplierLinkStatus(link.status) }]));
                return {
                    items: organizations.map((organization) => ({
                        id: organization.id, name: organization.name,
                        profileImage: organization.profileImg ?? organization.profilePhoto ?? null,
                        location: organization.location, contactNumber: organization.contactNumber,
                        relationshipId: linkBySupplier.get(organization.id)?.id ?? null,
                        relationshipStatus: linkBySupplier.get(organization.id)?.status ?? null,
                    })),
                    outlets, total, page, pageSize,
                };
            },
        });
        t.nonNull.field('registeredSupplierProfile', {
            type: 'RegisteredSupplierProfile',
            args: { supplierOrgId: nonNull(intArg()), outletId: intArg() },
            resolve: (_, args, ctx) => getRegisteredSupplierProfile(ctx, args),
        });
        t.nonNull.list.nonNull.field('supplierLinks', {
            type: 'SupplierLinkWorkspace', args: { status: arg({ type: 'SupplierLinkStatus' }) }, resolve: async (_, { status }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.view(ctx);
                const user = assertUser(ctx);
                await requireSupplierOrganization(ctx);
                // Returns retailer relationships for the current supplier organization.
                const links = await ctx.prisma.supplierOutletLink.findMany({ where: relationshipWhere({ supplierOrgId: user.orgId }, status), include: { outlet: { include: { org: true } }, assignedAgent: true }, orderBy: { updatedAt: 'desc' } });
                return Promise.all(links.map((link) => workspace(ctx, link, 'supplier')));
            }
        });
        t.nonNull.list.nonNull.field('retailerSupplierLinks', {
            type: 'SupplierLinkWorkspace', resolve: async (_, __, ctx) => {
                const user = assertUser(ctx);
                await requireRetailerOrganization(ctx);
                // Returns supplier relationships connected to the current retailer organization.
                const links = await ctx.prisma.supplierOutletLink.findMany({ where: { outlet: { orgId: user.orgId }, deletedAt: null }, include: { outlet: { include: { org: true } }, assignedAgent: true }, orderBy: { updatedAt: 'desc' } });
                return Promise.all(links.map((link) => workspace(ctx, link, 'retailer')));
            }
        });
        t.nullable.field('supplierLink', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => {
                // Returns one relationship workspace when the user belongs to either organization.
                const link = await assertLinkAccess(ctx, id);
                if (link.supplierOrgId === ctx.user.orgId) {
                    PAGE_PERMISSIONS.supplierLinks.view(ctx);
                    await requireSupplierOrganization(ctx);
                }
                else
                    await requireRetailerOrganization(ctx);
                return workspace(ctx, await ctx.prisma.supplierOutletLink.findUnique({ where: { id: link.id }, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true } }), link.supplierOrgId === ctx.user.orgId ? 'supplier' : 'retailer');
            }
        });
    }
});
export const SupplierLinkMutation = extendType({
    type: 'Mutation', definition(t) {
        t.nonNull.field('requestSupplierLink', {
            type: 'SupplierLinkWorkspace',
            args: { supplierOrgId: nonNull(intArg()), outletId: nonNull(intArg()) },
            resolve: async (_, { supplierOrgId, outletId }, ctx) => workspace(ctx, await requestCanonicalSupplierLink(ctx, supplierOrgId, outletId), 'retailer'),
        });
        t.nonNull.field('approveSupplierLink', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.edit(ctx);
                return workspace(ctx, await transitionSupplierLink(ctx, id, 'APPROVE'), 'supplier');
            },
        });
        t.nonNull.field('rejectSupplierLink', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.edit(ctx);
                return workspace(ctx, await transitionSupplierLink(ctx, id, 'REJECT'), 'supplier');
            },
        });
        t.nonNull.field('disableSupplierLink', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.edit(ctx);
                return workspace(ctx, await transitionSupplierLink(ctx, id, 'DISABLE'), 'supplier');
            },
        });
        t.nonNull.field('acceptSupplierLinkInvitation', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => workspace(ctx, await transitionSupplierInvitation(ctx, id, 'ACCEPT'), 'retailer'),
        });
        t.nonNull.field('rejectSupplierLinkInvitation', {
            type: 'SupplierLinkWorkspace', args: { id: nonNull(stringArg()) }, resolve: async (_, { id }, ctx) => workspace(ctx, await transitionSupplierInvitation(ctx, id, 'REJECT'), 'retailer'),
        });
        t.nonNull.field('createSupplierLink', {
            type: 'SupplierLinkWorkspace', args: { outletId: nonNull(intArg()) }, resolve: async (_, { outletId }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.create(ctx);
                const user = assertUser(ctx);
                await requireSupplierOrganization(ctx);
                const outlet = await ctx.prisma.outlet.findFirst({ where: { id: outletId, deletedAt: null, org: { roles: { has: 'SELLER' }, deletedAt: null, accountStatus: 'ACTIVE' } }, include: { org: true } });
                if (!outlet)
                    throw new Error('Outlet not found.');
                // Creates a supplier relationship request for a retailer outlet.
                const link = await ctx.prisma.supplierOutletLink.upsert({ where: { supplierOrgId_outletId: { supplierOrgId: user.orgId, outletId } }, create: { supplierOrgId: user.orgId, outletId, status: 'PENDING', requestedAt: new Date(), requestedById: user.id }, update: {}, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true } });
                return workspace(ctx, link, 'supplier');
            }
        });
        t.nonNull.field('updateSupplierLink', {
            type: 'SupplierLinkWorkspace', args: { input: nonNull(arg({ type: 'UpdateSupplierLinkInput' })) }, resolve: async (_, { input }, ctx) => {
                PAGE_PERMISSIONS.supplierLinks.edit(ctx);
                const current = await assertLinkAccess(ctx, input.id);
                const user = ctx.user;
                await requireSupplierOrganization(ctx);
                if (current.supplierOrgId !== user.orgId)
                    throw new Error('Supplier link not found.');
                if (input.status != null)
                    throw new Error('Use the named Supplier link lifecycle actions.');
                // Legacy mutation remains for non-lifecycle collaboration settings only.
                const data = { ...input };
                delete data.id;
                delete data.status;
                const link = await ctx.prisma.$transaction(async (tx) => { const updated = await tx.supplierOutletLink.update({ where: { id: input.id }, data, include: { outlet: { include: { org: true } }, assignedAgent: true, supplierOrg: true } }); await tx.auditLog.create({ data: { orgId: user.orgId, userId: user.id, pageKey: 'supplierLinksPage', action: 'EDIT', recordId: updated.id, recordType: 'SupplierOutletLink', newValue: data } }); return updated; });
                return workspace(ctx, link, 'supplier');
            }
        });
    }
});
