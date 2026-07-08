import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

type Access = "SELLER" | "SUPPLIER" | "POSTERMINAL" | "ADMIN";

interface PageType {
    key: string;
    label: string;
    sortOrder: number;
    parentKey?: string;
    access?: Access;
}

const pages: PageType[] = [
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
        parentKey: 'branchAndOutletPage',
        sortOrder: 14,
    },
    {
        key: 'posTerminalPage',
        label: 'POS Terminal',
        sortOrder: 15,
        access: 'POSTERMINAL',
    },
    {
        key: 'adminPage',
        label: 'Admin Page',
        sortOrder: 16,
        access: 'ADMIN',
    },
];

async function main() {
    console.log('🚀 Starting RBAC Seed...');

    // Seed pages
    for (const page of pages) {
        await prisma.page.upsert({
            where: { key: page.key },
            update: {
                label: page.label,
                parentKey: page.parentKey,
                access: page.access ?? 'SELLER',
                sortOrder: page.sortOrder,
            },
            create: {
                key: page.key,
                label: page.label,
                parentKey: page.parentKey,
                access: page.access ?? 'SELLER',
                sortOrder: page.sortOrder,
            },
        });

        console.log(`✅ Page: ${page.key}`);
    }

    // Create Admin Position
    console.log('🔍 Checking Admin Position...');

    let adminPosition = await prisma.position.findFirst({
        where: {
            name: 'System Administrator',
            orgId: null,
        },
    });

    if (!adminPosition) {
        adminPosition = await prisma.position.create({
            data: {
                name: 'System Administrator',
                description: 'System-wide administrator',
            },
        });

        console.log(`✅ Created Position: ${adminPosition.name}`);
    } else {
        console.log(`ℹ️ Position exists: ${adminPosition.name}`);
    }

    // Create Admin User
    console.log('🔍 Checking Admin User...');

    const adminEmail = 'raidevs.admin@kompra.com';
    const adminPassword = '#Rightech777#';

    let adminUser = await prisma.user.findUnique({
        where: {
            email: adminEmail,
        },
    });

    if (!adminUser) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        adminUser = await prisma.user.create({
            data: {
                fullname: 'System Administrator',
                username: 'admin',
                email: adminEmail,
                password: hashedPassword,
                role: Role.ADMIN,
                isVerified: true,
                isOwner: true,
                positionId: adminPosition.id,
            },
        });

        console.log('✅ Admin User Created');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Username: admin`);
        console.log(`   Password: ${adminPassword}`);
    } else {
        console.log(`ℹ️ Admin User exists: ${adminEmail}`);
    }

    const dbPages = await prisma.page.findMany();

    // Grant all page permissions to Admin Position
    console.log('🔐 Assigning page permissions...');

    for (const page of dbPages) {
        const existing = await prisma.positionPermission.findFirst({
            where: {
                positionId: adminPosition.id,
                pageId: page.id,
            },
        });

        if (!existing) {
            await prisma.positionPermission.create({
                data: {
                    positionId: adminPosition.id,
                    pageId: page.id,
                    canView: true,
                    canCreate: true,
                    canEdit: true,
                    canDelete: true,
                },
            });

            console.log(`✅ Permission granted: ${page.key}`);
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

    console.log('🔐 Assigning control permissions...');

    for (const controlKey of controlKeys) {
        const existing =
            await prisma.positionControlPermission.findFirst({
                where: {
                    positionId: adminPosition.id,
                    controlKey,
                },
            });

        if (!existing) {
            await prisma.positionControlPermission.create({
                data: {
                    positionId: adminPosition.id,
                    controlKey,
                    isAllowed: true,
                },
            });

            console.log(`✅ Control granted: ${controlKey}`);
        }
    }

    console.log('🎉 RBAC + Admin seed completed successfully.');
    // ==============================
    // DEV SANDBOX DATA
    // ==============================
    if (process.env.NODE_ENV === 'development') {
        // 1. Supplier Organization

        const supplierOrganization = await prisma.organization.findFirst({
            where: {
                name: "Dev Supplier"
            }
        })
        if (!supplierOrganization) {
            const newSupplierOrganization = await prisma.organization.create({
                data: {
                    name: "Dev Supplier",
                    roles: ["SUPPLIER"],
                    isDevSeed: true,
                    subscription: {
                        create: {
                            plan: "GOLD",
                        }
                    },
                    // depends on your schema
                    wallet: {
                        create: {
                            // ...
                        },
                    },

                    supplierCatalog: {
                        create: {
                            items: {
                                create: [
                                    {
                                        name: "Rice",
                                        unit: 'kg',
                                        unitPrice: 45,
                                        // ...
                                    },
                                    {
                                        name: "Coffee",
                                        unit: 'piece',
                                        unitPrice: 120,
                                    },
                                    {
                                        name: "Sugar",
                                        unit: 'kg',
                                        unitPrice: 60,
                                    },
                                    {
                                        name: "Cooking Oil",
                                        unit: 'liter',
                                        unitPrice: 180,
                                    },
                                    {
                                        name: "Soy Sauce",
                                        unit: 'bottle',
                                        unitPrice: 80,
                                    },
                                ],
                            },
                        },
                    },
                },
            });
            console.log("Created a supplier organization with sample catalog items for dev sandbox.");
            const supplierPass = await bcrypt.hash("supplier123", 10);
            await prisma.user.upsert({
                where: {
                    email: "supplier@supplier.dev.com"
                },
                update: {
                    fullname: "Dev Supplier User",
                    username: "devsupplier",
                    password: supplierPass
                },
                create: {
                    fullname: "Dev Supplier User",
                    username: "devsupplier",
                    email: "supplier@supplier.dev.com",
                    password: supplierPass,
                    role: 'OWNER',
                    isVerified: true,
                    isOwner: true,
                    orgId: newSupplierOrganization.id   
                }
            })
            console.log('Supplier organization and user created for dev sandbox.', 'Email:', "supplier@supplier.dev.com", 'Password:', "supplier123");
        } else {
            await prisma.organization.update({
                where: {
                    id: supplierOrganization.id
                },
                data: {
                    isDevSeed: true,
                    roles: ["SUPPLIER"],
                }
            })
            console.log('Supplier organization already exists for dev sandbox. Marked as dev seed.');
        } 
        const seller = await prisma.organization.findFirst({
            where: {
                name: "Dev Seller"
            }
        })
        if (!seller) {
            const sellerOrg = await prisma.organization.create({
                data: {
                    name: "Dev Seller",
                    roles: ["SELLER"],
                    isDevSeed: true,
                    subscription: {
                        create: {
                            plan: "GOLD",
                        }
                    },
                },
            });
            const sellerPass = await bcrypt.hash("seller123", 10);
            const sellerUser = await prisma.user.create({
                data: {
                    fullname: "Dev Seller User",
                    username: "devseller",
                    email: "seller@seller.dev.com",
                    password: sellerPass,
                    role: 'OWNER',
                    isVerified: true,
                    isOwner: true,
                    orgId: sellerOrg.id
                }
            })
            console.log("Seller user created:", sellerUser.email, "with password:", "seller123");

            await prisma.agent.create({
                data: {
                    fullname: "Seller Linked Agent",
                    email: "agentSeller@seller.dev.com",
                    agentType: "ORG_LINKED",
                    organizationId: sellerOrg.id,

                    verificationStatus: "APPROVED",
                    environment: "SANDBOX",
                    passwordHash: sellerPass,
                    isDevSeed: true,
                },
            });
        }

        const existingStandaloneAgent = await prisma.agent.findFirst({
            where: {
                email: "agentStandalone@standalone.dev.com"
            }
        });
        if (!existingStandaloneAgent) {
            await prisma.agent.create({
                data: {
                    fullname: "Standalone Agent",
                    email: "agentStandalone@standalone.dev.com",
                    agentType: "STANDALONE",
                    isDevSeed: true,
                    environment: "SANDBOX",
                    verificationStatus: "APPROVED",
                    passwordHash: await bcrypt.hash("standalone123", 10),
                },
            });
        }
        console.log('Agents created for dev sandbox: Seller Linked Agent and Standalone Agent');
        console.log('🎉 Dev sandbox data seeded successfully.');
    }
}

main()
    .catch((error) => {
        console.error('❌ Seed failed:', error);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });