import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient()

/**
 * @description
 * Creates a new user in the database.
 * @param {object} userData - The user's data.
 * @returns {Promise<object>} The newly created user object without the password
 */
export const createPaymongoAPIKey = async (APIKeyData, userId) => {
  // Hash the user's password before saving it to the database
  const hashedPK = await bcrypt.hash(APIKeyData.public_key, 10);
  
  const hashedSK = await bcrypt.hash(APIKeyData.secret_key, 10);

  const APIKey = await prisma.paymongoAPIKeys.create({
    data: {
      ownerId: userId,
      public_key: hashedPK,
      secret_key: hashedSK,
    },
  });
  // Remove password from the response for security
  const { password, ...userWithoutPassword } = APIKey;
  return userWithoutPassword;
};

/**
 * @description
 * Creates a new staff user in the database.
 * @param {object} staffData - The staff's data.
 * @returns {Promise<object>} The newly created user object without the password
 */
export const createStaff = async (staffData: any) => {
  // Check if the requested role is a valid staff role
  const hashedPassword = await bcrypt.hash(staffData.password, 10);
  const validRoles = ["MANAGER", "CASHIER", "STAFF"];
  if (!validRoles.includes(staffData.role)) {
    throw new Error("Invalid role provided for staff creation.");
  }
  // Create the new user with their role and managerId
  const user = await prisma.user.create({
    data: {
      ...staffData,
      password: hashedPassword,
    },
  });
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const getUserById = async (id: number) => {
  const user = await prisma.paymongoAPIKeys.findUnique({
    where: { id },
    select: {
      id: true,
      public_key: true,
      secret_key: true
    },
  });
  return user;
};