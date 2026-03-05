import { PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { InventoryItems } from '../graphql/typeDefs/inventoryItems.type.js';

/**
 * @description
 * Creates a new Outlet in the database.
 * @param {object} outletData - The Outlet's data (name, etc.).
 * @param {number} branchId - The ID of the branch the outlet belongs to.
 * @returns {Promise<object>} The newly created Outlet data.
 */
export const createOutlet = async (outletData, branchId, ownerId) => {
  const newOutletWithInventory = await prisma.outlet.create({
    data: {
      ...outletData,
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

    return { ...outletWithStaff, staff: outletWithStaff.staff.map(s => s.user), };
  } catch (error) {
    // You should add more specific error handling here, e.g., for duplicate entries.
    if (process.env.NODE_ENV === "development") console.error("Error adding staff to outlet:", error);
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

  return { ...newOutletStaffs, staff: newOutletStaffs.staff.map(s => s.user), };;
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
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("Error removing staff from outlet:", error);
    throw new Error("Failed to remove staff from the outlet.");
  }
};
/**
 * @description
 * Retrieves all outlets belonging to a specific branch.
 * This is a corrected version of the original getBranchOutlet.
 * @param {number} branchId - The ID of the branch.
 * @returns {Promise<object[]>} An array of outlet objects.
 */
export const getOutletsByBranchId = async (branchId) => {
  const outlets = await prisma.outlet.findMany({
    where: { branchId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      code: true,
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
      branch: true,
      staff: {
        select: {
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

export const getOutletStaffs = async (outletId: number) => {
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
  } catch (error) {
    // Log the error for internal debugging
    if (process.env.NODE_ENV === "development") console.error("Error fetching outlet staffs:", error);
    // Rethrow the error to be handled by the controller
    throw new Error("Failed to retrieve outlet staff.");
  }
};
export const getOutletItemsByAssignedStaff = async (
  userId: number,
  role: string
) => {
  const where =
    role === "ADMIN" || role === "MANAGER"
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
      governmentTax: true,
      serviceCharge: true,
      outletType: true,
      inventory: {
        select: {
          items: {
            select: {
              id: true,
              price: true,
              quantity: true,
              location: true,
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

  if (!outlet) return null;

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
    where: { id }, // Corrected to use a unique 'id'
    data: outletData,
  });
  if (process.env.NODE_ENV === "development") console.log("Updated Data:", updatedOutlet);
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


export const getOutletTransactions = async (outletId: number, startDate?: Date, endDate?: Date) => {

  return await prisma.transaction.findMany({
    where: {
      outletId: outletId,
      ...(startDate && endDate && {
        createdAt: { gte: startDate, lte: endDate }  // ✅ apply filter only if provided
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
  })
}

export const getPresentStaffs = async (outletId: number) => {

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
  })
  return staffs
}