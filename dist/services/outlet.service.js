import { prisma } from '../lib/prisma.js';
export const getInventoryItemById = async (id) => {
    return prisma.inventoryItems.findUnique({
        where: { id },
        select: {
            id: true,
            price: true,
            quantity: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
            item: {
                select: {
                    id: true,
                    name: true,
                    barcode: true,
                    brand: true,
                    stock: true,
                    sellingPrice: true,
                    description: true,
                    image: true,
                    costLines: { select: { id: true, label: true, amount: true } },
                },
            },
            units: {
                where: { isActive: true },
                orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
                select: {
                    id: true,
                    unitName: true,
                    unitLabel: true,
                    price: true,
                    quantity: true,
                    conversionFactor: true,
                    baseUnit: true,
                    barcode: true,
                    isDefault: true,
                    isActive: true,
                    allowDecimal: true,
                    minOrderQty: true,
                    maxOrderQty: true,
                    reorderPoint: true,
                },
            },
        },
    });
};
/**
 * @description
 * Creates a new Outlet in the database.
 * @param {object} outletData - The Outlet's data (name, etc.).
 * @param {number} branchId - The ID of the branch the outlet belongs to.
 * @returns {Promise<object>} The newly created Outlet data.
 */
export const createOutlet = async (outletData, branchId, ownerId) => {
    // Get the organization ID from branch
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { orgId: true }
    });
    if (!branch?.orgId) {
        throw new Error('Branch does not have an associated organization');
    }
    const newOutletWithInventory = await prisma.outlet.create({
        data: {
            ...outletData,
            org: {
                connect: {
                    id: branch.orgId,
                },
            },
            branch: {
                connect: {
                    id: branchId,
                },
            },
            owner: {
                connect: {
                    id: ownerId,
                },
            },
            // Nested write: Create the inventory at the same time as the outlet.
            // Prisma automatically handles the relationship.
            inventory: {
                create: {
                    name: `${outletData.name} Inventory`,
                },
            },
        },
        // Include the inventory in the response to confirm it was created.
        include: {
            inventory: true,
        },
    });
    return newOutletWithInventory;
};
/**
 * Gets the outlet assignment for the currently logged-in user.
 * Returns null if the user is not assigned to any outlet.
 *
 * @param {number} userId - The ID of the logged-in user.
 * @returns {Promise<{ outletId, role, outletName } | null>}
 */
export const getMyOutletAssignment = async (userId) => {
    const assignment = await prisma.outletStaff.findFirst({
        where: { userId },
        select: {
            role: true,
            outlet: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    if (!assignment)
        return null;
    return {
        outletId: assignment.outlet.id,
        outletName: assignment.outlet.name,
        role: assignment.role,
    };
};
/**
 * Adds an existing user as staff to a specific Outlet with a given role.
 *
 * @param {number} outletId - The ID of the Outlet.
 * @param {number} userId - The ID of the user to add as staff.
 * @param {string} role - The Outlet-specific role (e.g., 'CASHIER', 'SHIFT_LEAD').
 * @returns {Promise<object>} The new OutletStaff record.
 */
export const addStaffToOutlet = async (outletId, userId, role) => {
    try {
        await prisma.outletStaff.create({
            data: {
                outletId,
                userId,
                role,
            },
        });
        const outletWithStaff = await prisma.outlet.findFirst({
            where: { id: outletId },
            select: {
                id: true,
                name: true,
                staff: {
                    where: {
                        userId: userId,
                    },
                    select: {
                        user: {
                            select: {
                                id: true,
                                fullname: true,
                            },
                        },
                    },
                },
            },
        });
        return { ...outletWithStaff, staff: outletWithStaff?.staff.map(s => s.user) ?? [], };
    }
    catch (error) {
        // You should add more specific error handling here, e.g., for duplicate entries.
        if (process.env.NODE_ENV === "development")
            console.error("Error adding staff to outlet:", error);
        throw error;
    }
};
/**
 * Adds multiple users as staff to a specific Outlet with given roles.
 *
 * @param {number} outletId - The outlet ID.
 * @param {Array<{ userId: number; role: string }>} users - List of users with their roles.
 * @returns {Promise<object>} The result of the bulk insert.
 */
export const addStaffsToOutlet = async (outletId, users) => {
    // Validate all users exist
    const userIds = users.map((u) => Number(u.userId));
    const existingUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
    });
    const existingIds = existingUsers.map((u) => u.id);
    const missingIds = userIds.filter((id) => !existingIds.includes(id));
    if (missingIds.length > 0) {
        throw new Error(`User(s) not found: ${missingIds.join(", ")}`);
    }
    await prisma.outletStaff.createMany({
        data: users.map((u) => ({
            outletId,
            userId: Number(u.userId),
            role: u.role,
        })),
        skipDuplicates: true, // avoids unique constraint errors
    });
    const newOutletStaffs = await prisma.outlet.findFirst({
        where: { id: outletId },
        select: {
            id: true,
            name: true,
            staff: {
                where: {
                    userId: { in: users.map((u) => Number(u.userId)) },
                },
                select: {
                    user: {
                        select: {
                            id: true,
                            fullname: true,
                        },
                    },
                },
            },
        },
    });
    return { ...newOutletStaffs, staff: newOutletStaffs.staff.map(s => s.user), };
    ;
};
/**
 * Removes staff members from a outlet by deleting their entries in the OutletStaff table.
 * @param {number} outletId - The ID of the outlet
 * .
 * @param {string[]} userIds - An array of user IDs to remove from the Outlet.
 * @returns {Promise<{count: number}>} An object containing the number of deleted records.
 */
export const removeStaffsFromOutlet = async (outletId, userIds) => {
    try {
        const result = await prisma.outletStaff.deleteMany({
            where: {
                outletId: outletId,
                userId: { in: userIds },
            },
        });
        return result;
    }
    catch (error) {
        if (process.env.NODE_ENV === "development")
            console.error("Error removing staff from outlet:", error);
        throw new Error("Failed to remove staff from the outlet.");
    }
};
/**
 * @description
 * Retrieves all outlets belonging to a specific branch.
 * This is a corrected version of the original getBranchOutlet.
 * @param {number} branchId - The ID of the branch.
 * @param {string} search - Optional search string to filter by name or address.
 * @returns {Promise<object[]>} An array of outlet objects.
 */
export const getOutletsByBranchId = async (branchId, search) => {
    const outlets = await prisma.outlet.findMany({
        where: {
            branchId,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { address: { contains: search, mode: 'insensitive' } },
                ],
            }),
        },
        select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            code: true,
            bannerImage: true,
            governmentTax: true,
            serviceCharge: true,
            outletType: true,
            wifiSSID: true,
            branchId: true,
            createdAt: true,
            owner: {
                select: {
                    fullname: true,
                    username: true,
                    email: true,
                    role: true,
                },
            },
            staff: true,
            branch: true,
            //devices: true,
            //      inventory: true,
        },
    });
    return outlets;
};
/**
 * @description
 * Retrieves a single outlet from the database by its unique ID.
 * It also includes the associated branch data.
 * @param {number} id - The outlet's unique ID.
 * @returns {Promise<object|null>} The outlet object or null if not found.
 */
export const getOutletById = async (id) => {
    const outlet = await prisma.outlet.findUnique({
        where: { id },
        include: {
            staff: {
                include: {
                    user: {
                        select: {
                            email: true,
                            fullname: true,
                            role: true,
                        },
                    },
                },
            },
        },
    });
    return outlet;
};
export const getOutletStaffs = async (outletId) => {
    try {
        const staffs = await prisma.outletStaff.findMany({
            where: { outletId },
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        role: true,
                        password: false,
                    },
                },
            },
        });
        // Returns an empty array if no staffs are found, which is the correct behavior.
        return staffs.map((staff) => staff.user);
    }
    catch (error) {
        // Log the error for internal debugging
        if (process.env.NODE_ENV === "development")
            console.error("Error fetching outlet staffs:", error);
        // Rethrow the error to be handled by the controller
        throw new Error("Failed to retrieve outlet staff.");
    }
};
export const getOutletItemsByAssignedStaff = async (userId, role) => {
    const where = role === "ADMIN" || role === "MANAGER"
        ? { ownerId: userId }
        : { staff: { some: { userId: userId } } };
    const outlet = await prisma.outlet.findFirst({
        where,
        select: {
            id: true,
            branchId: true,
            name: true,
            address: true,
            phone: true,
            code: true,
            bannerImage: true,
            governmentTax: true,
            serviceCharge: true,
            outletType: true,
            isVatRegistered: true,
            vatZeroSale: true,
            tin: true,
            ptu: true,
            bir: true,
            vatType: {
                select: {
                    id: true,
                    name: true,
                    rate: true,
                },
            },
            outletPromos: {
                where: { isActive: true },
                select: {
                    id: true,
                    promoTypeId: true,
                    discount: true,
                    isActive: true,
                    promoType: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        },
                    },
                },
            },
            inventory: {
                select: {
                    items: {
                        select: {
                            id: true,
                            price: true,
                            quantity: true,
                            location: true,
                            units: {
                                where: { isActive: true },
                                select: {
                                    id: true,
                                    inventoryItemId: true,
                                    unitName: true,
                                    unitLabel: true,
                                    price: true,
                                    quantity: true,
                                    conversionFactor: true,
                                    baseUnit: true,
                                    isDefault: true,
                                    barcode: true,
                                    allowDecimal: true,
                                    isActive: true,
                                    minOrderQty: true,
                                    maxOrderQty: true,
                                    reorderPoint: true,
                                }
                            },
                            item: {
                                select: {
                                    id: true,
                                    image: true,
                                    description: true,
                                    barcode: true,
                                    name: true,
                                    categoryId: true,
                                    category: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!outlet)
        return null;
    // Flatten so it matches `OutletWithItems`
    return {
        ...outlet,
        items: outlet.inventory?.items ?? [],
    };
};
/**
 * @description
 * Updates an existing outlet by its ID.
 * @param {number} id - The outlet's unique ID.
 * @param {object} outletData - The updated outlet data.
 * @returns {Promise<object>} The updated outlet object.
 */
export const updateOutlet = async (id, outletData) => {
    const updatedOutlet = await prisma.outlet.update({
        where: { id },
        data: outletData,
        include: {
            staff: {
                include: {
                    user: {
                        select: {
                            email: true,
                            fullname: true,
                            role: true,
                        },
                    },
                },
            },
            outletPromos: true,
        },
    });
    return updatedOutlet;
};
/**
 * @description
 * Deletes a outlet from the database by its ID.
 * @param {number} id - The outlet's unique ID.
 * @returns {Promise<object>} The deleted outlet object.
 */
export const deleteOutlet = async (id) => {
    return await prisma.outlet.delete({
        where: { id },
    });
};
export const getOutletTransactions = async (outletId, startDate, endDate) => {
    return await prisma.transaction.findMany({
        where: {
            outletId: outletId,
            ...(startDate && endDate && {
                createdAt: { gte: startDate, lte: endDate } // ✅ apply filter only if provided
            })
        },
        select: {
            id: true,
            createdAt: true,
            total: true,
            status: true,
            subtotal: true,
            cashierId: true,
            paymentMethod: true,
            cashReceived: true,
            items: {
                select: {
                    quantity: true,
                    item: {
                        select: {
                            name: true,
                            InventoryItems: {
                                select: {
                                    price: true,
                                }
                            }
                        }
                    },
                }
            },
            cashier: {
                select: {
                    id: true,
                    fullname: true,
                    email: true,
                    role: true,
                }
            }
        }
    });
};
export const getPresentStaffs = async (outletId) => {
    const staffs = await prisma.outletStaff.findMany({
        where: { outletId: outletId, isPresent: true },
        select: {
            outletId: true,
            id: true,
            isPresent: true,
            outlet: true,
            user: {
                select: {
                    id: true,
                    fullname: true,
                    email: true,
                    role: true,
                }
            }
        }
    });
    return staffs;
};
export const getOutlets = async () => {
    const outlets = await prisma.outlet.findMany();
    return outlets;
};
