import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { resolvePermissionState } from '../src/lib/permissionResolution.js';
import { SUPPLIER_PAGE_KEYS } from '../src/lib/permissions.map.js';
import { requirePagePermission } from '../src/middleware/auth.middleware.js';
import { requireSupplierItemScope, requireSupplierOrganizationScope } from '../src/lib/supplierScope.js';
import type { Context, PagePermission } from '../src/lib/types.js';

const pageKey = SUPPLIER_PAGE_KEYS.products;
const base: PagePermission = { canView: true, canCreate: true, canEdit: false, canDelete: false };

const sameOrg = resolvePermissionState({
  userOrgId: 10,
  positionOrgId: 10,
  positionPermissions: [{ page: { key: pageKey }, ...base }],
  overrides: [{ page: { key: pageKey }, canView: null, canCreate: false, canEdit: true, canDelete: null }],
  controlPermissions: [{ controlKey: 'exampleControl', isAllowed: true }],
});
assert.deepEqual(sameOrg.userPermissions[pageKey], {
  canView: true,
  canCreate: false,
  canEdit: true,
  canDelete: false,
});
assert.equal(sameOrg.controlPermissions.exampleControl, true);

const overrideOnly = resolvePermissionState({
  userOrgId: 10,
  positionOrgId: 10,
  overrides: [{ page: { key: pageKey }, canView: true, canCreate: null, canEdit: null, canDelete: false }],
});
assert.deepEqual(overrideOnly.userPermissions[pageKey], {
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
});

const crossOrg = resolvePermissionState({
  userOrgId: 10,
  positionOrgId: 20,
  positionPermissions: [{ page: { key: pageKey }, canView: true, canCreate: true, canEdit: true, canDelete: true }],
  overrides: [{ page: { key: pageKey }, canView: true, canCreate: true, canEdit: true, canDelete: true }],
});
assert.deepEqual(crossOrg, { userPermissions: {}, controlPermissions: {} });

const context = (permission: PagePermission | undefined, user: Record<string, unknown> | null = {
  id: 1,
  userId: 1,
  email: 'staff@example.test',
  role: 'SUPPLIER',
  isOwner: false,
  orgId: 10,
  orgAccountStatus: 'ACTIVE',
}) => ({
  user,
  userPermissions: permission ? { [pageKey]: permission } : {},
  controlPermissions: {},
} as unknown as Context);

for (const action of ['canView', 'canCreate', 'canEdit', 'canDelete'] as const) {
  const allowed = { canView: false, canCreate: false, canEdit: false, canDelete: false, [action]: true };
  assert.doesNotThrow(() => requirePagePermission(context(allowed), pageKey, action));
  assert.throws(
    () => requirePagePermission(context({ ...allowed, [action]: false }), pageKey, action),
    /You do not have permission to perform this action\./,
  );
}

let mutationWrites = 0;
const deniedDirectMutation = () => {
  requirePagePermission(context({ canView: true, canCreate: false, canEdit: false, canDelete: false }), pageKey, 'canCreate');
  mutationWrites += 1;
};
assert.throws(deniedDirectMutation, /You do not have permission/);
assert.equal(mutationWrites, 0, 'denied direct mutation must perform zero writes');

assert.equal(requireSupplierOrganizationScope(context(base), 10), 10);
assert.throws(() => requireSupplierOrganizationScope(context(base), 20), /Resource not found/);
const itemScopeContext = {
  ...context(base),
  prisma: {
    supplierItem: {
      findFirst: async ({ where }: any) => where.catalog.organizationId === 10 && where.id === 'owned-item'
        ? { id: 'owned-item' }
        : null,
    },
  },
} as unknown as Context;
await assert.doesNotReject(() => requireSupplierItemScope(itemScopeContext, 'owned-item'));
await assert.rejects(() => requireSupplierItemScope(itemScopeContext, 'other-org-item'), /Resource not found/);

assert.throws(() => requirePagePermission(context(undefined, null), pageKey, 'canView'), /Authentication required/);
assert.throws(() => requirePagePermission(context(undefined), pageKey, 'canView'), /You do not have permission/);
assert.doesNotThrow(() => requirePagePermission(context(undefined, {
  id: 2,
  userId: 2,
  email: 'owner@example.test',
  role: 'SUPPLIER',
  isOwner: true,
  orgId: 10,
  orgAccountStatus: 'ACTIVE',
}), pageKey, 'canDelete'));
assert.doesNotThrow(() => requirePagePermission(context(undefined, {
  id: 3,
  userId: 3,
  email: 'manager@example.test',
  role: 'MANAGER',
  isOwner: false,
  orgId: 10,
  orgAccountStatus: 'ACTIVE',
}), pageKey, 'canDelete'));

const supplierKeys = Object.values(SUPPLIER_PAGE_KEYS);
assert.equal(new Set(supplierKeys).size, supplierKeys.length, 'Supplier page keys must be unique');
const seedSource = await readFile(new URL('../prisma/seed.ts', import.meta.url), 'utf8');
for (const key of supplierKeys) {
  assert.match(seedSource, new RegExp(`key:\\s*['\"]${key}['\"]`), `seed is missing ${key}`);
}

console.log(`PASS: ${supplierKeys.length} unique Supplier page keys are present in the seed.`);
console.log('PASS: position inheritance and field-by-field nullable/explicit user overrides.');
console.log('PASS: view/create/edit/delete allow and direct backend rejection behavior.');
console.log('PASS: unauthenticated, missing-permission, cross-organization resource scope, owner, and manager cases.');
console.log('Supplier RBAC verification complete; no database connection or mutation was used.');
