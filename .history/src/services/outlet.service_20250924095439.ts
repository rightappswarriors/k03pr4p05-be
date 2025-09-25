import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @description
 * Creates a new Store in the database.
 * @param {object} storeData - The Store's data (name, etc.).
 * @param {number} branchId - The ID of the branch the store belongs to.
 * @returns {Promise<object>} The newly created Store data.
 */
export const createStore = async (storeData, branchId, ownerId) => {
  const newStoreWithInventory = await prisma.outlet.create({
    data: {
      ...storeData,
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
      // Nested write: Create the inventory at the same time as the store.
      // Prisma automatically handles the relationship.
      inventory: {
        create: {
          name: `${storeData.name} Inventory`,
        },
      },
    },
    // Include the inventory in the response to confirm it was created.
    include: {
      inventory: true,
    },
  });

  return newStoreWithInventory;
};
/**
 * @description
 * Retrieves a single store from the database by its unique ID.
 * It also includes the associated branch data.
 * @param {number} id - The store's unique ID.
 * @returns {Promise<object|null>} The store object or null if not found.
 */
export const getStoreById = async (id) => {
  const store = await prisma.outlet.findUnique({
    where: { id },
    include: {
      branch: true,
      staff: {
        select: {
          user: {
            select: {
              password: false,
              email: true,
              fullname: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return store;
};
/**
 * Adds an existing user as staff to a specific store with a given role.
 *
 * @param {number} storeId - The ID of the store.
 * @param {number} userId - The ID of the user to add as staff.
 * @param {string} role - The store-specific role (e.g., 'CASHIER', 'SHIFT_LEAD').
 * @returns {Promise<object>} The new StoreStaff record.
 */
export const addStaffToStore = async (outletId, userId, role) => {
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
    console.error("Error adding staff to store:", error);
    throw error;
  }
};
/**
 * Adds an existing user as staff to a specific store with a given role.
 *
 * @param {<object>} users - List of users.
 * @returns {Promise<object>} The new StoreStaff record.
 */

export const addStaffsToStore = async (users) => {
  const newStaffs = await prisma.outletStaff.createMany({
    data: [users],
  });
  return newStaffs;
};
/**
 * Removes staff members from a store by deleting their entries in the StoreStaff table.
 * @param {number} storeId - The ID of the store.
 * @param {string[]} userIds - An array of user IDs to remove from the store.
 * @returns {Promise<{count: number}>} An object containing the number of deleted records.
 */
export const removeStaffsFromStore = async (outletId, userIds) => {
  try {
    const result = await prisma.outletStaff.deleteMany({
      where: {
        outletId: outletId,
        userId: { in: userIds },
      },
    });
    return result;
  } catch (error) {
    console.error("Error removing staff from store:", error);
    throw new Error("Failed to remove staff from the store.");
  }
};

export const getStoreStaffs = async (outletId) => {
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
    console.error("Error fetching store staffs:", error);
    // Rethrow the error to be handled by the controller
    throw new Error("Failed to retrieve store staff.");
  }
};

export const getStoreItemsByAssingedStaff = async (userId) => {
  // Use findFirst instead of findUnique, as userId is not a unique
  // identifier for a store.
  const items = await prisma.outlet.findFirst({
    // Use a nested 'where' clause with the 'some' operator.
    // This tells Prisma to look for a Store where 'some' (at least one)
    // of its related 'staff' records has a matching 'userId'.
    where: {
      staff: {
        some: {
          userId: userId,
        },
      },
    },
    select: {
      name: true,
      address: true,
      governmentTax: true,
      serviceCharge: true,
      inventory: {
        select: {
          items: {
            select: {
              item: true
            }
          },
        },
      },
    },
  });
  return items;
};

/**
 * @description
 * Retrieves all stores belonging to a specific branch.
 * This is a corrected version of the original getBranchStores.
 * @param {number} branchId - The ID of the branch.
 * @returns {Promise<object[]>} An array of store objects.
 */
export const getStoresByBranchId = async (branchId) => {
  const stores = await prisma.outlet.findMany({
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
  return stores;
};

/**
 * @description
 * Updates an existing store by its ID.
 * @param {number} id - The store's unique ID.
 * @param {object} storeData - The updated store data.
 * @returns {Promise<object>} The updated store object.
 */
export const updateStore = async (id, storeData) => {
  const updatedStore = await prisma.outlet.update({
    where: { id }, // Corrected to use a unique 'id'
    data: storeData,
  });
  return updatedStore;
};

/**
 * @description
 * Deletes a store from the database by its ID.
 * @param {number} id - The store's unique ID.
 * @returns {Promise<object>} The deleted store object.
 */
export const deleteStore = async (id) => {
  return await prisma.outlet.delete({
    where: { id },
  });
};
