import { objectType } from 'nexus';
export const Organization = objectType({
    name: 'Organization',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nullable.string('bannerImg');
        t.nullable.string('profileImg');
        t.nullable.string('contactNumber');
        t.nullable.string('email');
        t.nullable.string('location');
        t.nullable.string('profilePhoto');
        t.nullable.string('facebookLink');
        t.nullable.string('instagramLink');
        t.nullable.string('twitterLink');
        t.nullable.string('bio');
        t.nonNull.list.nonNull.field('roles', { type: 'OrgRole' });
        t.nonNull.boolean('isDevSeed');
        t.nonNull.list.nonNull.field('verificationStatus', { type: 'OrgVerificationStatus' });
        t.nullable.dateTime('verificationExpiresAt');
        t.nonNull.float('averageRating', {
            resolve: async (parent, _, ctx) => {
                const aggregate = await ctx.prisma.organizationReview.aggregate({
                    where: { organizationId: parent.id, deletedAt: null },
                    _avg: { rating: true },
                });
                return Number((aggregate._avg.rating ?? 0).toFixed(2));
            },
        });
        t.nonNull.int('reviewCount', {
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.count({
                where: { organizationId: parent.id, deletedAt: null },
            }),
        });
        t.nonNull.int('totalReviews', {
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.count({
                where: { organizationId: parent.id, deletedAt: null },
            }),
        });
        t.nonNull.int('verifiedReviewsCount', {
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.count({
                where: { organizationId: parent.id, deletedAt: null, isVerifiedTransaction: true },
            }),
        });
        t.nonNull.list.nonNull.field('reviewsReceived', {
            type: 'OrganizationReview',
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.findMany({
                where: { organizationId: parent.id, deletedAt: null },
                include: { reviewer: true },
                orderBy: { createdAt: 'desc' },
            }),
        });
        t.nonNull.list.nonNull.field('reviews', {
            type: 'OrganizationReview',
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.findMany({
                where: { organizationId: parent.id, deletedAt: null },
                include: { reviewer: true },
                orderBy: { createdAt: 'desc' },
            }),
        });
        t.nonNull.list.nonNull.field('reviewsWritten', {
            type: 'OrganizationReview',
            resolve: (parent, _, ctx) => ctx.prisma.organizationReview.findMany({
                where: { reviewerOrgId: parent.id, deletedAt: null },
                include: { reviewer: true },
                orderBy: { createdAt: 'desc' },
            }),
        });
        t.nullable.field('wallet', {
            type: 'Wallet',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).wallet();
            },
        });
        t.nonNull.list.nonNull.field('payoutMethods', {
            type: 'PayoutMethod',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).payoutMethods();
            },
        });
        t.nonNull.list.nonNull.field('businessVerificationsDocuments', {
            type: 'BusinessVerificationDocument',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).businessVerificationsDocuments();
            },
        });
        t.nonNull.list.nonNull.field('paymentGatewayCreds', {
            type: 'PaymentGatewayCredential',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).paymentGatewayCreds();
            },
        });
        t.nonNull.list.nonNull.field('linkedAgents', {
            type: 'Agent',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).linkedAgents();
            },
        });
        t.nonNull.list.nonNull.field('mandateOffersReceived', {
            type: 'MandateOffer',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).mandateOffersReceived();
            },
        });
        t.nonNull.list.nonNull.field('mandateTransactions', {
            type: 'MandateTransaction',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).mandateTransactions();
            },
        });
        t.nonNull.list.nonNull.field('attendances', {
            type: 'Attendance',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).attendances();
            },
        });
        t.nonNull.list.nonNull.field('budgets', {
            type: 'Budget',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).budgets();
            },
        });
        t.nonNull.list.nonNull.field('contacts', {
            type: 'Contact',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).contacts();
            },
        });
        t.nonNull.list.nonNull.field('notifications', {
            type: 'Notification',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).notifications();
            },
        });
        t.nonNull.list.nonNull.field('orgCategories', {
            type: 'OrgItemCategory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).orgCategories();
            },
        });
        t.nonNull.list.nonNull.field('restockCycles', {
            type: 'RestockCycle',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).restockCycles();
            },
        });
        t.nonNull.list.nonNull.field('restockSchedules', {
            type: 'RestockSchedule',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).restockSchedules();
            },
        });
        t.nonNull.list.nonNull.field('scPwdCustomers', {
            type: 'ScPwdCustomer',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).scPwdCustomers();
            },
        });
        t.nonNull.list.nonNull.field('shifts', {
            type: 'Shift',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).shifts();
            },
        });
        t.nonNull.list.nonNull.field('stockBatches', {
            type: 'StockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).stockBatches();
            },
        });
        t.nullable.field('supplierCatalog', {
            type: 'SupplierCatalog',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).supplierCatalog();
            },
        });
        t.nonNull.list.nonNull.field('sentPOs', {
            type: 'PurchaseOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).sentPOs();
            },
        });
        t.nonNull.list.nonNull.field('receivedPOs', {
            type: 'PurchaseOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).receivedPOs();
            },
        });
        t.nonNull.list.nonNull.field('buyerReceivedItemMaps', {
            type: 'ReceivedItemMap',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).buyerReceivedItemMaps();
            },
        });
        t.nonNull.list.nonNull.field('supplierLinks', {
            type: 'SupplierOutletLink',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).supplierLinks();
            },
        });
        t.nonNull.list.nonNull.field('supplierOrders', {
            type: 'SupplierOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).supplierOrders();
            },
        });
        t.nullable.field('subscription', {
            type: 'Subscription',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).subscription();
            }
        });
        t.nonNull.list.nonNull.field('users', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).users();
            }
        });
        t.nonNull.list.nonNull.field('branches', {
            type: 'Branch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).branches();
            }
        });
        t.nonNull.list.nonNull.field('outlets', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).outlets();
            }
        });
        t.nonNull.list.nonNull.field('items', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).items();
            }
        });
        t.nonNull.list.nonNull.field('itemCategories', {
            type: 'ItemCategory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).itemCategories();
            }
        });
        t.nonNull.list.nonNull.field('vatTypes', {
            type: 'VatType',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).vatTypes();
            }
        });
        t.nonNull.list.nonNull.field('departments', {
            type: 'Department',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).departments();
            }
        });
        t.nonNull.list.nonNull.field('positions', {
            type: 'Position',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).positions();
            }
        });
        t.nonNull.list.nonNull.field('centers', {
            type: 'Center',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).centers();
            }
        });
        t.nonNull.list.nonNull.field('subCenters', {
            type: 'SubCenter',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).subCenters();
            }
        });
        t.nonNull.list.nonNull.field('accountTitles', {
            type: 'AccountTitle',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).accountTitles();
            }
        });
        t.nonNull.list.nonNull.field('gisRows', {
            type: 'GISRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).gisRows();
            }
        });
        t.nonNull.list.nonNull.field('summaryRows', {
            type: 'SummaryRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).summaryRows();
            }
        });
        t.nonNull.list.nonNull.field('salesOrders', {
            type: 'SalesOrder',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).salesOrders();
            }
        });
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
        });
        t.nonNull.list.nonNull.field('inventoryItems', {
            type: 'InventoryItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).inventoryItems();
            }
        });
        t.nonNull.list.nonNull.field('employees', {
            type: 'Employee',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).employees();
            }
        });
        t.nonNull.list.nonNull.field('promoTypes', {
            type: 'PromoType',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).promoTypes();
            }
        });
        t.nonNull.list.nonNull.field('itemGroups', {
            type: 'ItemGroup',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).itemGroups();
            }
        });
        t.nonNull.list.nonNull.field('brands', {
            type: 'Brand',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization.findUnique({ where: { id: parent.id } }).brands();
            }
        });
        t.nonNull.list.nonNull.field('supplierWarehouses', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.organization
                    .findUnique({ where: { id: parent.id } })
                    .supplierWarehouses({
                    orderBy: {
                        name: 'asc',
                    },
                });
            },
        });
    }
});
