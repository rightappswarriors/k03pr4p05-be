import { objectType, enumType } from 'nexus';
export const Role = enumType({
    name: 'Role',
    members: ['ADMIN', 'STAFF', "MANAGER", "CASHIER", "OWNER"]
});
export const TimeInStatus = objectType({
    name: 'TimeInStatus',
    definition(t) {
        t.nonNull.boolean('hasTimeIn');
        t.nullable.dateTime('lastTimeIn');
        t.nonNull.string('status');
    }
});
export const User = objectType({
    name: 'User',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('fullname');
        t.nonNull.string('username');
        t.nonNull.string('email');
        t.nonNull.field('role', { type: 'Role' });
        t.nonNull.string('password');
        // backend onboarding status
        t.nonNull.boolean('isVerified');
        t.nullable.string('verificationCode');
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('updatedAt');
        t.nullable.string('profilePhoto');
        t.nullable.string('zipCode');
        t.nullable.string('city');
        t.nullable.string('address');
        t.nullable.string('country');
        t.nullable.dateTime('dateOfBirth');
        t.nullable.string('zipCode');
        t.nullable.int('managerId');
        t.nonNull.boolean('enabledPaymentMethod');
        t.nullable.string('contactNumber');
        t.nullable.string('positionId');
        t.nullable.field('position', {
            type: 'Position',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user.findUnique({ where: { id: parent.id } }).position();
            }
        });
        t.nullable.int('departmentId');
        t.nullable.field('department', {
            type: 'Department',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .department();
            }
        });
        t.nullable.int('orgId'); // Added for multi-tenancy, onboarding may set after org creation
        t.nullable.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .org();
            }
        });
        t.nonNull.list.nonNull.field('branchesOwned', {
            type: 'Branch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .branchesOwned();
            }
        });
        t.nonNull.list.nonNull.field('outletOwned', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .outletOwned();
            }
        });
        t.nonNull.list.field('staff', {
            type: 'OutletStaff',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .staff();
            }
        });
        t.nonNull.list.field('employees', {
            type: 'Employee',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .employees();
            }
        });
        t.nonNull.list.field('gisRows', {
            type: 'GISRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .gisRows();
            }
        });
        t.nonNull.list.field('summaryRows', {
            type: 'SummaryRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .summaryRows();
            }
        });
        t.nonNull.list.field('salesOrders', {
            type: 'SalesOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .salesOrders();
            }
        });
        t.nonNull.list.field('inventoryItems', {
            type: 'InventoryItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .inventoryItems();
            }
        });
        t.nonNull.list.field('transaction', {
            type: 'Transaction',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .transaction();
            }
        });
        t.nullable.field('manager', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .manager();
            }
        });
        t.nullable.field('paymongoAPIKeys', {
            type: 'PaymongoAPIKeys',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user
                    .findUnique({ where: { id: parent.id } })
                    .paymongoAPIKeys();
            }
        });
        t.nonNull.list.field("promoType", {
            type: "PromoType",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.promoType({
                    where: {
                        id: parent.id
                    }
                }).promoType();
            }
        });
        t.nonNull.list.field("outletPromo", {
            type: "OutletPromo",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletPromo({
                    where: {
                        id: parent.id
                    }
                }).outletPromo();
            }
        });
    }
});
