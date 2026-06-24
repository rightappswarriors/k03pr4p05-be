import { extendType, intArg, stringArg, floatArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export const inventoryItemMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createInventoryItem', {
            type: 'InventoryItem',
            args: {
                orgId: intArg(),
                name: stringArg(),
                quantity: intArg(),
                price: floatArg(),
                itemGroupId: intArg()
            },
            resolve: async (_, { orgId, name, quantity, price, itemGroupId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.inventory.create(ctx);
                return ctx.prisma.inventoryItem.create({
                    data: { orgId, name, quantity, price, itemGroupId }
                });
            }
        });
        t.field('updateInventoryItem', {
            type: 'InventoryItem',
            args: {
                id: intArg(),
                name: stringArg(),
                quantity: intArg(),
                price: floatArg(),
                itemGroupId: intArg()
            },
            resolve: async (_, { id, name, quantity, price, itemGroupId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.inventory.edit(ctx);
                return ctx.prisma.inventoryItem.update({
                    where: { id },
                    data: { name, quantity, price, itemGroupId }
                });
            }
        });
        t.field('deleteInventoryItem', {
            type: 'InventoryItem',
            args: {
                id: intArg()
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.inventory.edit(ctx);
                return ctx.prisma.inventoryItem.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            }
        });
    }
});
