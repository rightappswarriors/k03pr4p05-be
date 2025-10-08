import { PrismaClient } from "@prisma/client";
import { decrypt, encrypt } from "../lib/encrypt";
const prisma = new PrismaClient();
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
export const updateAPIKeyByUserId = async (ownerId, data) => {
    // Fetch existing record first
    const existingKey = await prisma.paymongoAPIKeys.findUnique({ where: { ownerId } });
    if (!existingKey)
        throw new Error("API key record not found");
    // Prepare updated fields
    const updateData = {};
    if (data.public_key) {
        updateData.public_key = encrypt(data.public_key);
    }
    if (data.secret_key) {
        updateData.secret_key = encrypt(data.secret_key);
    }
    // Update only changed fields
    const updated = await prisma.paymongoAPIKeys.update({
        where: { ownerId },
        data: updateData,
    });
    // Optionally mask sensitive info before returning
    return {
        ...updated,
        public_key: data.public_key
            ? data.public_key.slice(0, 6) + "************" + data.public_key.slice(-4)
            : "[unchanged]",
        secret_key: data.secret_key
            ? "sk_************" + data.secret_key.slice(-4)
            : "[unchanged]",
    };
};
export const getUserAPIKeyByUserId = async (id) => {
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
