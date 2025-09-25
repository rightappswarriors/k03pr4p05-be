// services/category.service.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * @description
 * Creates a new category record.
 * @param {object} categoryData - The data for the new category.
 * @returns {Promise<object>} The newly created category.
 */
export const createCategory = async (categoryData) => {
  const newCategory = await prisma.category.create({
    data: {
      ...categoryData,
    },
  });

  return newCategory;
};
/**
 * @description
 * Bulk creates multiple categories in the database.
 * @param {Array<object>} categories - An array of category objects.
 * @returns {Promise<object>} An object containing the count of created categories.
 */
export const createCategories = async (categories) => {
  return prisma.category.createMany({
    data: categories, // Optionally, you can skip items with duplicate names
  });
};

/**
 * @description
 * Retrieves a single category by its unique ID.
 * @param {number} id - The ID of the category.
 * @returns {Promise<object|null>} The category found or null.
 */
export const getCategoryById = async (id) => {
  const categoryFound = await prisma.category.findUnique({
    where: { id },
    select: {
      name: true,
    },
  });
  return categoryFound;
};
export const getAllCategories = async () => {
  const categories = await prisma.category.findMany({
    select: {
      name: true,
    },
  });
  return categories;
};
/**
 * @description
 * Retrieves all items associated with a specific category.
 * @param {number} id - The ID of the category.
 * @returns {Promise<object[]|null>} An array of items in that category or null if not found.
 */
export const getItemsByCategoryId = async (id) => {
  // Using findUnique is more efficient here since an ID is a unique key.
  const categoryWithItems = await prisma.category.findUnique({
    where: { id },
    select: {
      items: true, // Selects the items related to this category.
    },
  });

  // Return the array of items, or null if the category wasn't found.
  return categoryWithItems?.items || null;
};

/**
 * @description
 * Updates an existing category by its ID.
 * @param {number} id - The ID of the category to update.
 * @param {object} categoryData - The data to update the category with.
 * @returns {Promise<object>} The updated category record.
 */
export const updateCategoryById = async (id, categoryData) => {
  const updatedCategory = await prisma.category.update({
    where: { id },
    data: categoryData, // Corrected: use categoryData instead of storeData
  });
  return updatedCategory;
};

/**
 * @description
 * Deletes a category and all its related items in a single transaction.
 * @param {number} id - The ID of the category to delete.
 * @returns {Promise<void>}
 */
export const deleteCategory = async (id) => {
  // Use a transaction to ensure both deletions succeed or fail together.
  await prisma.$transaction(async (tx) => {
    // First, delete all items that belong to the category.
    await tx.item.deleteMany({
      where: { categoryId: id },
    });

    // Then, delete the category itself.
    await tx.category.delete({
      where: { id },
    });
  });
};
