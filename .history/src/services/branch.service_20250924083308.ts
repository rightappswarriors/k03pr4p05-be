import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * @description
 * Creates a new Branch in the database.
 * @param {object} branchData - The Branch's data (name, address, etc.).
 * @param {number} ownerId - The ID of the user who owns the branch.
 * @returns {Promise<object>} The newly created Branch data.
 */

export const createBranch = async (branchData, ownerId) => {
  const newBranchData = await prisma.branch.create({
    data: {
      ...branchData,
      ownerId: ownerId,
    },
  });

  return newBranchData;
};

/**
 * @description
 * Retrieves a single branch from the database by its unique ID.
 * @param {number} id - The branch's unique ID.
 * @returns {Promise<object|null>} The branch object or null if not found.
 */
export const getBranchById = async (id) => {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          fullname: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
    }, // You might want to include the owner details
  });
  return branch;
};

/**
 * @description
 * Retrieves all branches owned by a specific user.
 * @param {number} ownerId - The ID of the user who owns the branches.
 * @returns {Promise<object[]>} An array of branch objects.
 */
export const getOwnedBranches = async (ownerId) => {
  // Corrected the method name to findMany
  const branches = await prisma.branch.findMany({
    where: { ownerId },
    select: {
      id: true, // It's a good practice to always select the ID
      name: true,
      address: true,
      phone: true,
      // You can remove the 'owner' field here, as we already know who the owner is
    },
  });
  // No need for a null check; findMany returns an empty array if nothing is found.
  return branches;
};

/**
 * @description
 * Updates an existing branch by its ID.
 * @param {number} id - The branch's unique ID.
 * @param {object} branchData - The updated branch data.
 * @returns {Promise<object>} The updated branch object.
 */
export const updateBranch = async (id, branchData) => {
  const updatedBranch = await prisma.branch.update({
    where: { id }, // Corrected to use a unique 'id'
    data: branchData,
  });
  return updatedBranch;
};

/**
 * @description
 * Deletes a branch from the database by its ID.
 * @param {number} id - The branch's unique ID.
 * @returns {Promise<object>} The deleted branch object.
 */
export const deleteBranch = async (id) => {
  return await prisma.branch.delete({
    where: { id },
  });
};
