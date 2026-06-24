import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pages = [
    { key: 'dashboardPage', label: 'Dashboard', sortOrder: 0 },
    { key: 'salesOrderPage', label: 'Sales Order', sortOrder: 1 },
    { key: 'kompraOrderPage', label: 'Kompra Order', sortOrder: 2 },
    { key: 'financePage', label: 'Finance', sortOrder: 3 },
    { key: 'inventoryPage', label: 'Inventory', sortOrder: 4 },
    { key: 'restockSchedulingPage', label: 'Restock Scheduling', sortOrder: 5 },
    { key: 'discountPage', label: 'Discount', sortOrder: 6 },
    { key: 'auditLogPage', label: 'Audit Log', sortOrder: 7 },
    { key: 'hrPage', label: 'HR', sortOrder: 8 },
    { key: 'salesAnalyticsPage', label: 'Sales Analytics', sortOrder: 9 },
    { key: 'masterFilePage', label: 'Master File', sortOrder: 10 },
    { key: 'branchAndOutletPage', label: 'Branch & Outlet', sortOrder: 11 },
    {
        key: 'outletPage',
        label: 'Outlet',
        parentKey: 'branchAndOutletPage',
        sortOrder: 12,
    },
    {
        key: 'branchPage',
        label: 'Branch',
        parentKey: 'branchAndOutletPage',
        sortOrder: 13,
    },
    {
        key: 'outletInventoryPage',
        label: 'Outlet Inventory',
        parentKey: 'BranchAndOutletPage',
        sortOrder: 14,
    },
    {
        key: 'posTerminalPage',
        label: 'POS Terminal',
        parentKey: 'inventoryPage',
        sortOrder: 14,
    },
];

async function main() {
    // Seed pages
    for (const page of pages) {
        await prisma.page.upsert({
            where: { key: page.key },
            update: page,
            create: page,
        });
    }

    // Get positions
    const positions = await prisma.position.findMany();

    // Get pages
    const dbPages = await prisma.page.findMany();

    // Give all permissions to all positions (customize as needed)
    for (const position of positions) {
        for (const page of dbPages) {
            const existing = await prisma.positionPermission.findFirst({
                where: {
                    positionId: position.id,
                    pageId: page.id,
                },
            });

            if (!existing) {
                await prisma.positionPermission.create({
                    data: {
                        positionId: position.id,
                        pageId: page.id,
                        canView: true,
                        canCreate: true,
                        canEdit: true,
                        canDelete: true,
                    },
                });
            }
        }
    }

    // Control permissions
    const controlKeys = [
        'approveDiscount',
        'cancelOrder',
        'voidTransaction',
        'approveRestock',
        'manageUsers',
        'managePermissions',
    ];

    for (const position of positions) {
        for (const controlKey of controlKeys) {
            const existing =
                await prisma.positionControlPermission.findFirst({
                    where: {
                        positionId: position.id,
                        controlKey,
                    },
                });

            if (!existing) {
                await prisma.positionControlPermission.create({
                    data: {
                        positionId: position.id,
                        controlKey,
                        isAllowed: true,
                    },
                });
            }
        }
    }

    console.log('RBAC seeded successfully.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });