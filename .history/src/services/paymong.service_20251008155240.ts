import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { encrypt } from "../lib/encrypt";
const prisma = new PrismaClient()

/**
 * @description
 * Creates a new user in the database.
 * @param {object} userData - The user's data.
 * @returns {Promise<object>} The newly created user object without the password
 */
export const createPaymongoAPIKey = async (APIKeyData, userId) => {
  // Hash the user's password before saving it to the database
  const encryptedPK = encrypt(APIKeyData.public_key)
const encryptedSK = encrypt(APIKeyData.secret_key)

const APIKey = await prisma.paymongoAPIKeys.create({
  data: {
    ownerId: userId,
    public_key: encryptedPK,
    secret_key: encryptedSK,
  },
})

  return APIKey;
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