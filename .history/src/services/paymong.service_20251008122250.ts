import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient()

export const getUserById = async (id: number) => {
  const user = await prisma.paymongoAPIKeys.findUnique({
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