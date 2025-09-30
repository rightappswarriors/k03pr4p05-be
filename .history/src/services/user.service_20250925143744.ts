// services/user.service.js
// This file acts as the 'cook'. It contains the core business logic and interacts directly with the database.
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// A secret key to sign and verify your JWTs. In a real-world app, this should be an environment variable.

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const prisma = new PrismaClient();

/**
 * @description
 * Creates a new user in the database.
 * @param {object} userData - The user's data.
 * @returns {Promise<object>} The newly created user object without the password
 */

export const createUser = async (userData) => {
  // Hash the user's password before saving it to the database
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      ...userData,
      password: hashedPassword,
    },
  });
  // Remove password from the response for security
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};


/**
 * @description
 * Creates a new staff user in the database.
 * @param {object} staffData - The staff's data.
 * @returns {Promise<object>} The newly created user object without the password
 */
export const createStaff = async (staffData) => {
  // Check if the requested role is a valid staff role
  const hashedPassword = await bcrypt.hash(staffData.password, 10);
  const validRoles = ["MANAGER", "CASHIER"];
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

/**
 * @description
 * Authenticates a user by email and password and returns a JWT on success.
 * @param {string} email - The user's email.
 * @param {string} password - The plain-text password.
 * @returns {Promise<object|null>} An object with the user and the JWT if successful, or null if authentication fails.
 */
export const loginUser = async (email, password) => {
  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return null;
  }
  console.log("User: ")
  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
  console.log(JWT_SECRET)
  const refresh_token = jwt.sign(
    {
      userId: user.id,
    },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  // Remove password from the response for security
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token, refresh_token };
};
/**
 * @description
 * Verifies a JWT and returns the decoded payload.
 * @param {string} token - The JWT to verify.
 * @returns {object|null} The decoded token payload or null if verification fails.
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};
/**
 * Refreshes an access token using a valid refresh token.
 * This function should be called when the access token expires.
 * @param {string} refreshToken - The refresh token from a secure cookie.
 * @returns {Promise<string|null>} A new access token, or null if the refresh token is invalid.
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return null;
    }

    const newAccessToken = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    return newAccessToken;
  } catch (error) {
    return null;
  }
};
/**
 * @description
 * Retrieves all users from the database.
 * @returns {Promise<array>} An array of user objects without password
 */

export const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullname: true,
      username: true,
      role: true,
    },
  });
  return users;
};
/**
 * @description
 * Retrieves a single user from the database by ID.
 * @param {number} id - The user's ID.
 * @returns {Promise<object>} The user object without the password.
 */

export const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullname: true,
      username: true,
      role: true,
    },
  });
  return user;
};
/**
 * @description
 * Updates an existing user in the database.
 * @param {number} id - The user's ID.
 * @param {object} userData - The updated user's data.
 * @returns {Promise<object>} The updated user object without the password.
 */

export const updateUser = async (id, userData) => {
  const userToUpdate = { ...userData };
  if (userData.password) {
    userToUpdate.password = await bcrypt.hash(userData.password, 10);
  }
  const updatedUser = await prisma.user.update({
    where: { id },
    data: userToUpdate,
  });

  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

/**
 * @description
 * Deletes a user from the database.
 * @param {number} id - The user's ID.
 * @returns {Promise<object>} The deleted user object.
 */
export const deleteUser = async (id) => {
  return await prisma.user.delete({
    where: { id },
  });
};
