
import { decrypt, encrypt } from "../lib/encrypt.js";
import { prisma } from '../lib/prisma.js';

/**
 * @description
 * Creates a new user in the database.
 * @param {object} userData - The user's data.
 * @returns {Promise<object>} The newly created user object without the password
 */
export const createPaymongoAPIKey = async (userId, APIKeyData) => {
  // Hash the user's password before saving it to the database
  const encryptedPK = encrypt(APIKeyData.public_key);
  const encryptedSK = encrypt(APIKeyData.secret_key);

  const APIKey = await prisma.paymongoAPIKeys.create({
    data: {
      ownerId: userId,
      public_key: encryptedPK,
      secret_key: encryptedSK,
    },
  });

  return APIKey;
};


export const updateAPIKeyByUserId = async (ownerId: number, data: any) => {
  // Fetch existing record first
  const existingKey = await prisma.paymongoAPIKeys.findUnique({ where: { ownerId } })
  if (!existingKey) throw new Error("API key record not found")

  // Prepare updated fields
  const updateData: any = {}

  if (data.public_key) {
    updateData.public_key = encrypt(data.public_key)
  }

  if (data.secret_key) {
    updateData.secret_key = encrypt(data.secret_key)
  }

  // Update only changed fields
  const updated = await prisma.paymongoAPIKeys.update({
    where: { ownerId },
    data: updateData,
  })

  return {
    ...updated,
    public_key: data.public_key
      ? data.public_key.slice(0, 6) + "************" + data.public_key.slice(-4)
      : "[unchanged]",
    secret_key: data.secret_key
      ? "sk_************" + data.secret_key.slice(-4)
      : "[unchanged]",
  }
}

export const getUserAPIKeyByUserId = async (id: number) => {
  const userKey = await prisma.paymongoAPIKeys.findUnique({
    where: { ownerId: id },
    select: {
      id: true,
      public_key: true,
      secret_key: true,
    },
  });
  return {
    ...userKey,
    public_key: decrypt(userKey.public_key),
    secret_key: decrypt(userKey.secret_key)
  };
};
export const deleteAPI = async (id: number) => {
  return await prisma.$transaction(async (tx) => {
    const apiKey = await prisma.paymongoAPIKeys.findFirst({
      where: { id: id },
    })
    if (!apiKey) {
      throw new Error("APIKEY not found")
    }

    await prisma.outlet.findMany({
      where: {
        apiKeyId: id
      },
      data: {
        haskey: false
      }
    })
    await prisma.paymongoAPIKeys.delete({
      where: { id: id }
    })
    return true
  })
}
export const addingAPIKeyToOutlet = async (outletId: number, apiKeyId: number) => {
  const outlet = prisma.outletId.findFirst({
    where: { id: outletId },
    select: {
      id: true
    }
  })
  if (!outlet) {
    throw new Error("Outlet not found.")
  }
  await prisma.outlet.update({
    where: { id: outletId },
    data: {
      apiKeyId: apiKeyId,
      hasKey: true,
    }
  })

  return true
}


export const clearApiToOutlet = async (outletId: number) => {
  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId },
    select: {
      id: true
    }
  })
  if (!outlet) {
    throw new Error("Outlet not found.")
  }
  await prisma.outlet.update({
    where: { id: outletId },
    data: {
      apiKeyId: null,
      haskey: false
    }
  })

  return true
}