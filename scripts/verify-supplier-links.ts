import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

import { requirePagePermission } from '../src/middleware/auth.middleware.js';
import {
  canonicalSupplierLinkStatus,
  hasApprovedSupplierRetailerLink,
  isSupplierLinkTransitionAllowed,
  normalizeSupplierLinkPage,
  requestCanonicalSupplierLink,
  requireRetailerOutlet,
  requireSupplierLinkForReview,
  supplierLinkOrderBy,
  supplierLinkStatusValues,
} from '../src/services/supplierLink.service.js';
import { getRegisteredSupplierProfile } from '../src/services/supplierBusinessProfile.service.js';

async function expectReject(run: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(run, pattern);
}

async function main() {
  assert.equal(canonicalSupplierLinkStatus('REQUESTED'), 'PENDING');
  assert.equal(canonicalSupplierLinkStatus('ACTIVE'), 'APPROVED');
  assert.equal(canonicalSupplierLinkStatus('BLOCKED'), 'REJECTED');
  assert.equal(canonicalSupplierLinkStatus('PAUSED'), 'DISABLED');
  assert.deepEqual(supplierLinkStatusValues('PENDING'), ['SUGGESTED', 'REQUESTED', 'PENDING']);
  assert.deepEqual(supplierLinkStatusValues('APPROVED'), ['ACCEPTED', 'ACTIVE', 'APPROVED']);
  assert.equal(isSupplierLinkTransitionAllowed('PENDING', 'APPROVE'), true);
  assert.equal(isSupplierLinkTransitionAllowed('PENDING', 'REJECT'), true);
  assert.equal(isSupplierLinkTransitionAllowed('APPROVED', 'DISABLE'), true);
  assert.equal(isSupplierLinkTransitionAllowed('APPROVED', 'APPROVE'), true, 'approval retry is idempotent');
  assert.equal(isSupplierLinkTransitionAllowed('APPROVED', 'REJECT'), false);
  assert.equal(isSupplierLinkTransitionAllowed('REJECTED', 'DISABLE'), false);

  assert.deepEqual(normalizeSupplierLinkPage(2, 50), { page: 2, pageSize: 50, skip: 50 });
  assert.throws(() => normalizeSupplierLinkPage(1, 25), /20, 50, or 100/);
  assert.deepEqual(supplierLinkOrderBy('STATUS', 'ASC'), { status: 'asc' });
  assert.throws(() => supplierLinkOrderBy('raw sql', 'DESC'), /Unsupported/);

  const ownedOutlet = { id: 7, orgId: 11, name: 'Main Outlet', org: { id: 11 } };
  const ownershipCtx: any = {
    user: { id: 3, orgId: 11, role: 'OWNER', isOwner: true },
    prisma: {
      organization: { findFirst: async ({ where }: any) => where.id === 11 ? { id: 11 } : null },
      outlet: { findFirst: async ({ where }: any) => where.id === 7 && where.orgId === 11 ? ownedOutlet : null },
    },
  };
  assert.equal((await requireRetailerOutlet(ownershipCtx, 7)).id, 7);
  await expectReject(() => requireRetailerOutlet(ownershipCtx, 99), /Retailer outlet not found/);

  const supplierCtx: any = {
    user: { id: 4, orgId: 22, role: 'OWNER', isOwner: true },
    prisma: {
      organization: { findFirst: async ({ where }: any) => where.id === 22 ? { id: 22 } : null },
      supplierOutletLink: { findFirst: async ({ where }: any) => where.id === 'owned' && where.supplierOrgId === 22 ? { id: 'owned', supplierOrgId: 22, status: 'PENDING' } : null },
    },
  };
  assert.equal((await requireSupplierLinkForReview(supplierCtx, 'owned')).supplierOrgId, 22);
  await expectReject(() => requireSupplierLinkForReview(supplierCtx, 'supplier-b-link'), /Supplier link not found/);

  assert.equal(await hasApprovedSupplierRetailerLink({ supplierOutletLink: { findFirst: async () => ({ id: 'approved' }) } }, { supplierOrgId: 22, outletId: 7 }), true);
  assert.equal(await hasApprovedSupplierRetailerLink({ supplierOutletLink: { findFirst: async () => null } }, { supplierOrgId: 22, retailerOrgId: 11 }), false);

  const deniedCtx: any = { user: { id: 4, orgId: 22, role: 'STAFF', isOwner: false }, userPermissions: {}, controlPermissions: {} };
  assert.throws(() => requirePagePermission(deniedCtx, 'supplierLinksPage', 'canView'), /permission/);
  deniedCtx.userPermissions.supplierLinksPage = { canView: true, canCreate: false, canEdit: false, canDelete: false };
  requirePagePermission(deniedCtx, 'supplierLinksPage', 'canView');
  assert.throws(() => requirePagePermission(deniedCtx, 'supplierLinksPage', 'canEdit'), /permission/);

  const rows = new Map<string, any>();
  const requestCtx: any = {
    user: { id: 3, orgId: 11, role: 'OWNER', isOwner: true },
    prisma: {
      organization: { findFirst: async ({ where }: any) => where.id === 11 || where.id === 22 ? { id: where.id } : null },
      outlet: { findFirst: async ({ where }: any) => where.id === 7 && where.orgId === 11 ? ownedOutlet : null },
      $transaction: async (run: any) => run({
        supplierOutletLink: {
          upsert: async ({ create }: any) => { const key = `${create.supplierOrgId}:${create.outletId}`; if (!rows.has(key)) rows.set(key, { id: 'canonical', createdAt: new Date(), ...create }); return rows.get(key) },
          findUnique: async () => rows.size ? ({ ...rows.values().next().value, outlet: ownedOutlet, supplierOrg: { id: 22 }, assignedAgent: null }) : null,
          update: async () => { throw new Error('pending retry must not update') },
        },
        notification: {
          findFirst: async () => null,
          create: async ({ data }: any) => ({ id: 1, createdAt: new Date(), ...data }),
        },
      }),
    },
  };
  const first = await requestCanonicalSupplierLink(requestCtx, 22, 7);
  const retry = await requestCanonicalSupplierLink(requestCtx, 22, 7);
  assert.equal(first?.id, retry?.id);
  assert.equal(rows.size, 1, 'duplicate requests retain one canonical row');

  let capturedProductWhere: any = null;
  const profileCtx: any = {
    user: { id: 3, orgId: 11, role: 'OWNER', isOwner: true },
    prisma: {
      organization: {
        findFirst: async ({ where }: any) => where.id === 11
          ? { id: 11 }
          : where.id === 22
            ? { id: 22, name: 'Verified Supplier', profileImg: null, profilePhoto: null, bannerImg: null, location: 'Manila', contactNumber: 'Business line', bio: 'Wholesale goods', verificationStatus: 'VERIFIED', createdAt: new Date('2025-01-01') }
            : null,
      },
      outlet: { findFirst: async ({ where }: any) => where.id === 7 && where.orgId === 11 ? ownedOutlet : null },
      supplierOutletLink: { findFirst: async () => ({ id: 'approved', status: 'APPROVED' }) },
      organizationReview: { aggregate: async () => ({ _avg: { rating: 4.5 }, _count: { _all: 2 } }) },
      supplierItem: {
        count: async ({ where }: any) => { capturedProductWhere = where; return 3 },
        findMany: async () => [{ id: 'item-1', name: 'Rice', image: null, unit: 'bag', moq: 2, globalCategory: { name: 'Staples' }, category: null }],
      },
      purchaseOrder: { groupBy: async () => [{ status: 'COMPLETED', _count: { _all: 8 } }, { status: 'REJECTED', _count: { _all: 1 } }, { status: 'CANCELLED', _count: { _all: 1 } }, { status: 'PENDING', _count: { _all: 4 } }] },
      delivery: { groupBy: async () => [{ status: 'DELIVERED', _count: { _all: 9 } }, { status: 'FAILED', _count: { _all: 1 } }, { status: 'SCHEDULED', _count: { _all: 2 } }] },
      category: { findMany: async () => [{ name: 'Staples' }] },
      supplierItemCategory: { findMany: async () => [{ name: 'Local Staples' }] },
    },
  };
  const profile = await getRegisteredSupplierProfile(profileCtx, { supplierOrgId: 22, outletId: 7 });
  assert.equal(profile.metrics.overallRating, 4.5);
  assert.equal(profile.metrics.activeProducts, 3);
  assert.equal(profile.metrics.orderCompletionRate, 80);
  assert.equal(profile.metrics.deliveryCompletionRate, 90);
  assert.deepEqual(profile.categories, ['Staples', 'Local Staples']);
  assert.equal(capturedProductWhere.catalog.organizationId, 22);
  assert.equal(capturedProductWhere.marketplaceListing.status, 'PUBLISHED');
  profileCtx.prisma.organizationReview.aggregate = async () => ({ _avg: { rating: null }, _count: { _all: 0 } });
  profileCtx.prisma.purchaseOrder.groupBy = async () => [];
  profileCtx.prisma.delivery.groupBy = async () => [];
  const emptyHistoryProfile = await getRegisteredSupplierProfile(profileCtx, { supplierOrgId: 22, outletId: 7 });
  assert.equal(emptyHistoryProfile.metrics.overallRating, null);
  assert.equal(emptyHistoryProfile.metrics.orderCompletionRate, null);
  assert.equal(emptyHistoryProfile.metrics.deliveryCompletionRate, null);
  await expectReject(() => getRegisteredSupplierProfile(profileCtx, { supplierOrgId: 11, outletId: 7 }), /not found/);

  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /model SupplierOutletLink[\s\S]*@@unique\(\[supplierOrgId, outletId\]\)/);
  const migration = await readFile(new URL('../prisma/migrations/20260912090000_supplier_retailer_link_lifecycle/migration.sql', import.meta.url), 'utf8');
  const supplierLinkResolver = await readFile(new URL('../src/graphql/resolvers/supplierLink/supplierLink.resolver.ts', import.meta.url), 'utf8');
  assert.match(migration, /ACTIVE', 'ACCEPTED'[\s\S]*APPROVED/);
  assert.match(migration, /ELSE 'PENDING'/);
  assert.match(supplierLinkResolver, /supplierOrgId: link\.supplierOrgId, deliveryOutletId: link\.outletId/);
  assert.doesNotMatch(supplierLinkResolver, /supplierOrgId: link\.supplierOrgId, outletId: link\.outletId/);
  const sessionPolicy = await readFile(new URL('../../k03pr4p05-fe/services/sessionInactivity.ts', import.meta.url), 'utf8');
  const authContext = await readFile(new URL('../../k03pr4p05-fe/contexts/AuthContext.tsx', import.meta.url), 'utf8');
  assert.match(sessionPolicy, /INACTIVITY_TIMEOUT_MS = 30 \* 60 \* 1000/);
  assert.match(sessionPolicy, /recordSessionActivityIfActive/);
  assert.match(authContext, /document\.visibilityState === 'visible'[\s\S]*refreshForegroundSession/);
  assert.match(authContext, /Your session expired after 30 minutes of inactivity/);

  if (process.argv.includes('--database')) {
    const prisma = new PrismaClient();
    try {
      const outletRows = await prisma.$queryRawUnsafe<Array<{ status: string; isApproved: boolean; count: bigint }>>('SELECT status::text AS status, "isApproved", COUNT(*)::bigint AS count FROM "SupplierOutletLink" GROUP BY status, "isApproved" ORDER BY status');
      const organizationRows = await prisma.$queryRawUnsafe<Array<{ status: string; isApproved: boolean; count: bigint }>>('SELECT status::text AS status, "isApproved", COUNT(*)::bigint AS count FROM "SupplierOrganizationLink" GROUP BY status, "isApproved" ORDER BY status');
      const supplier = await prisma.organization.findFirst({ where: { roles: { has: 'SUPPLIER' }, accountStatus: 'ACTIVE', deletedAt: null }, select: { id: true } });
      const retailer = await prisma.organization.findFirst({ where: { roles: { has: 'SELLER' }, accountStatus: 'ACTIVE', deletedAt: null, ...(supplier ? { id: { not: supplier.id } } : {}) }, select: { id: true } });
      const links = await prisma.supplierOutletLink.findMany({
        where: { deletedAt: null },
        select: { id: true, supplierOrgId: true, outletId: true, status: true, isApproved: true, outlet: { select: { name: true, orgId: true, org: { select: { id: true, name: true, roles: true } } } } },
      });
      const supplierIds = [...new Set(links.map((link) => link.supplierOrgId))];
      const canonicalCounts: Record<number, Record<string, number>> = {};
      for (const supplierOrgId of supplierIds) {
        const scopedRows = links.filter((link) => link.supplierOrgId === supplierOrgId);
        canonicalCounts[supplierOrgId] = {};
        for (const status of ['PENDING', 'APPROVED', 'REJECTED', 'DISABLED'] as const) {
          const canonicalCount = scopedRows.filter((link) => canonicalSupplierLinkStatus(link.status) === status).length;
          const listCount = await prisma.supplierOutletLink.count({ where: { supplierOrgId, deletedAt: null, status: { in: supplierLinkStatusValues(status) as any } } });
          assert.equal(listCount, canonicalCount, `${status} list population must reconcile with the canonical KPI population for Supplier ${supplierOrgId}`);
          canonicalCounts[supplierOrgId][status] = canonicalCount;
        }
      }
      const pendingLinkAudit = links
        .filter((link) => canonicalSupplierLinkStatus(link.status) === 'PENDING')
        .map((link) => ({
          id: link.id, supplierOrgId: link.supplierOrgId, outletId: link.outletId, status: link.status, isApproved: link.isApproved,
          retailerOrganizationId: link.outlet.orgId, retailerOrganizationName: link.outlet.org.name, retailerRoles: link.outlet.org.roles,
          outletName: link.outlet.name,
        }));
      const auditedProfile = supplier && retailer
        ? await getRegisteredSupplierProfile({ prisma, user: { id: 0, orgId: retailer.id } } as any, { supplierOrgId: supplier.id })
        : null;
      console.log('Database audit:', JSON.stringify({ supplierOutletLinks: outletRows, supplierOrganizationLinks: organizationRows, pendingLinkAudit, canonicalCounts, supplierProfileMetrics: auditedProfile?.metrics ?? null }, (_, value) => typeof value === 'bigint' ? Number(value) : value));
    } finally { await prisma.$disconnect(); }
  }

  console.log('Supplier Links verifier passed: lifecycle, canonical KPI/list reconciliation, idempotency, ownership, cross-org isolation, RBAC, profile metrics/privacy filters, session policy source contract, pagination, sorting, helper, and legacy mapping.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
