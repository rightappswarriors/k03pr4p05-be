// services/user.service.js
// This file acts as the 'cook'. It contains the core business logic and interacts directly with the database.

import { prisma } from '../lib/prisma.js';

import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// A secret key to sign and verify your JWTs. In a real-world app, this should be an environment variable.

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

if (!REFRESH_SECRET) {
  throw new Error('REFRESH_SECRET environment variable is not set');
}



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
export const createStaff = async (staffData: any) => {
  // Check if the requested role is a valid staff role
  const hashedPassword = await bcrypt.hash(staffData.password, 10);
  const userExists = await prisma.user.findUnique({
    where: { email: staffData.email },
  });
  if (userExists) {
    throw new Error('A user with this email already exists.');
  }
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

/**
 * @description
 * Authenticates a user by email and password and returns a JWT on success.
 * @param {string} email - The user's email.
 * @param {string} password - The plain-text password.
 * @returns {Promise<object|null>} An object with the user and the JWT if successful, or null if authentication fails.
 */
export const loginUser = async (email: any, password: any, res: any) => {
  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log(`User not found for email: ${email}`);
    return null;
  }

  if (!user.password) {
    console.log(`User ${email} has no password stored`);
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    console.log(`Invalid password for user: ${email}`);
    return null;
  }

  // Check if user has verified their email
  if (user.role !== "ADMIN") {
    if (!user.isVerified) {
      console.log(`User ${email} has not verified their email`);
      throw new Error('Please verify your email before logging in.');
    }
    if (process.env.NODE_ENV === "development") {
      console.log("User: ", user.username);
      console.log("User Role: ", user.role);
      console.log("User fullname: ", user.fullname);
    }
  }

  const staffexists = await prisma.outletStaff.findFirst({
    where: { userId: user.id }
  })
  if (process.env.NODE_ENV === "development") console.log("Staff exists: ", staffexists);
  if (staffexists) {
    await prisma.outletStaff.update({
      where: { id: staffexists.id },
      data: { isPresent: true, }
    })
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
  const refresh_token = jwt.sign(
    {
      userId: user.id,
    },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("jid", refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // or "none" if frontend is on a different port
    path: "/graphql"
  })
  // Remove password from the response for security
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token, refresh_token };
};
/**
 * @description
 * Retrieves all Staff users for a specific organization.
 * @param {number} orgId - Organization Id to query staff for.
 * @returns {Promise<array>} An array of user objects without password
 */
export const getAllStaffs = async (orgId: number) => {
  const users = await prisma.user.findMany({
    where: {
      orgId: orgId,
    },
    select: {
      id: true,
      email: true,
      fullname: true,
      username: true,
      role: true,
      profilePhoto: true,
      createdAt: true,
      positionId: true,
      departmentId: true,
    },
  });
  if (process.env.NODE_ENV === "development") console.log("Org Id:", orgId)
  if (process.env.NODE_ENV === "development") console.log("Users:", users)
  return users;
};

/**
 * @description
 * Retrieves all Staff users owned by the manager from the database.
 * @param {number} ownerId - Manager Id query.
 * @returns {Promise<array>} An array of user objects without password
 */
export const getAllOutletStaffs = async (ownerId: number) => {
  const outlets = await prisma.outlet.findMany({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      staff: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              fullname: true,
            },
          },
        },
      },
    },
  });

  // Flatten staff array to `staffs` array of users
  return outlets.map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
    staff: outlet.staff.map((s) => s.user),
  }));
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

export const getUserById = async (id: number) => {
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



export const getStaffByOutletId = async (outletId: number) => {
  const staffs = await prisma.outletStaff.findMany({
    where: { outletId },
    include: { user: true }
  })
  if (!staffs || staffs.length === 0) {
    return []
  }


  console.log("Users staff by outlet id:", staffs)
  return staffs
    .filter(s => s.user)   // make sure user is not null
    .map(s => ({
      id: s.id,
      outletId: s.outletId,
      isPresent: s.isPresent,
      user: s.user
    }))
}
