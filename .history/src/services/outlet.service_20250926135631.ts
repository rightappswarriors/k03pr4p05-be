import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

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
    const newStaff = await prisma.outletStaff.create({
      data: {
        outletId,
        userId,
        role,
      },
    });
    return newStaff;
  } catch (error) {
    // You should add more specific error handling here, e.g., for duplicate entries.
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
  const newStaffs = await prisma.outletStaff.createMany({
    data: users.map((u) => ({
      outletId,
      userId: u.userId,
      role: u.role,
    })),
    skipDuplicates: true, // avoids unique constraint errors
  });

  return newStaffs;
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
    console.error("Error removing staff from outlet:", error);
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
      owner: {
        select: {
          fullname: true,
          username: true,
          email: true,
          role: true,
        },
      },
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
    return staffs;
  } catch (error) {
    // Log the error for internal debugging
    console.error("Error fetching outlet staffs:", error);
    // Rethrow the error to be handled by the controller
    throw new Error("Failed to retrieve outlet staff.");
  }
};

export const getOutletItemsByAssignedStaff = async (userId: number) => {
  const outlet = await prisma.outlet.findFirst({
    where: {
      staff: {
        some: { userId },
      },
    },
    select: {
      inventory: {
        select: {
          items: {
            select: {
              id: true,
              quantity: true,
              item: true,
              location: true,
            },
          },
        },
      },
    },
  });

  return outlet?.inventory?.items ?? [];
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
  console.log(updateOutlet)
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
