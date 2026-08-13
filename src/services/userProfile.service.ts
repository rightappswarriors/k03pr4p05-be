import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const passwordRules = [
  { message: "Password must be at least 8 characters.", test: (value: string) => value.length >= 8 },
  { message: "Password must include an uppercase letter.", test: (value: string) => /[A-Z]/.test(value) },
  { message: "Password must include a lowercase letter.", test: (value: string) => /[a-z]/.test(value) },
  { message: "Password must include a number.", test: (value: string) => /[0-9]/.test(value) },
  { message: "Password must include a special character.", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

function validateStrongPassword(password: string) {
  const failedRule = passwordRules.find((rule) => !rule.test(password));
  if (failedRule) {
    throw new Error(failedRule.message);
  }
}

export async function changePassword({
  userId,
  oldPassword,
  newPassword,
}: {
  userId: number;
  oldPassword: string;
  newPassword: string;
}) {
  if (!oldPassword || !newPassword) {
    throw new Error("Old password and new password are required.");
  }

  validateStrongPassword(newPassword);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.password) {
    throw new Error("User not found.");
  }

  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordValid) {
    throw new Error("Old password is incorrect.");
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new Error("New password must be different from the old password.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return true;
}
