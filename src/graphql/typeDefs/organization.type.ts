import { objectType } from 'nexus'

export const Organization = objectType({
    name: 'Organization',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('name')
        t.nonNull.dateTime('createdAt')
        t.nullable.field('subscription', {
            type: 'Subscription',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).subscription();
            }
        })
        t.nonNull.list.nonNull.field('users', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).users();
            }
        })
        t.nonNull.list.nonNull.field('branches', {
            type: 'Branch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).branches();
            }
        })
        t.nonNull.list.nonNull.field('outlets', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).outlets();
            }
        })
        t.nonNull.list.nonNull.field('items', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).items();
            }
        })
        t.nonNull.list.nonNull.field('itemCategories', {
            type: 'ItemCategory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).itemCategories();
            }
        })
        t.nonNull.list.nonNull.field('vatTypes', {
            type: 'VatType',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).vatTypes();
            }
        })
        t.nonNull.list.nonNull.field('departments', {
            type: 'Department',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).departments();
            }
        })
        t.nonNull.list.nonNull.field('positions', {
            type: 'Position',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).positions();
            }
        })
        t.nonNull.list.nonNull.field('centers', {
            type: 'Center',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).centers();
            }
        })
        t.nonNull.list.nonNull.field('subCenters', {
            type: 'SubCenter',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).subCenters();
            }
        })
        t.nonNull.list.nonNull.field('accountTitles', {
            type: 'AccountTitle',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).accountTitles();
            }
        })
        t.nonNull.list.nonNull.field('gisRows', {
            type: 'GISRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).gisRows();
            }
        })
        t.nonNull.list.nonNull.field('summaryRows', {
            type: 'SummaryRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).summaryRows();
            }
        })
        t.nonNull.list.nonNull.field('salesOrders', {
            type: 'SalesOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).salesOrders();
            }
        })
        t.nonNull.list.nonNull.field('kompraCOrders', {
            type: 'KompraCOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).kompraCOrders({
                    include: {
                        items: true,
                        fees: true,
                        tracking: true,
                        outlet: true,
                        customer: true,
                        courier: true,
                        deliveryAddress: true,
                    }
                });
            }
        })
        t.nonNull.list.nonNull.field('inventoryItems', {
            type: 'InventoryItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).inventoryItems();
            }
        })
        t.nonNull.list.nonNull.field('employees', {
            type: 'Employee',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).employees();
            }
        })
        t.nonNull.list.nonNull.field('promoTypes', {
            type: 'PromoType',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).promoTypes();
            }
        })
        t.nonNull.list.nonNull.field('itemGroups', {
            type: 'ItemGroup',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).itemGroups();
            }
        })
        t.nonNull.list.nonNull.field('brands', {
            type: 'Brand',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).brands();
            }
        })
    }
})