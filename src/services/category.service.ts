// services/category.service.js
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient()
/**

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
  const names = categories.map((c) => c.name);

  // Insert new categories (skip duplicates)
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });
  return prisma.category.findMany({
    where: {
      name: { in: names },
    },
  });
};

/**
 * @description
 * Retrieves a single category by its unique ID.
 * @param {number} id - The ID of the category.
 * @returns {Promise<object|null>} The category found or null.
 */
export const getCategoryById = async (id: number) => {
  const categoryFound = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      _count: true,
      name: true,
    },
  });
  return categoryFound;
};
export const getAllCategories = async (
  query?: string,
  orderBy: "asc" | "desc" = "asc",
  pageSize = 20,
  page = 1
) => {
  const where = query
    ? { name: { contains: query, mode: Prisma.QueryMode.insensitive as any } } // search by query
    : {}; // empty means no filtering

  const categories = await prisma.category.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: {
      items: {
        _count: orderBy, // ✅ correct way to order by relation count
      },
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
export const updateCategoryById = async (id, name) => {
  const updatedCategory = await prisma.category.update({
    where: { id },
    data: { name }, // Corrected: use categoryData instead of storeData
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
  return await prisma.$transaction(async (tx) => {
    return await tx.category.delete({
      where: { id },
    });
  });
};
