import { extendType, nonNull, stringArg, nullable, arg } from "nexus";
import * as userAPIKey from "../../../services/userAPI.service.js";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
export const ApiMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("createAPIKey", {
            type: "PaymongoAPIKeys",
            args: {
                public_key: nonNull(stringArg()),
                secret_key: nonNull(stringArg())
            },
            resolve: async (_, { public_key, secret_key }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN"]);
                if (!public_key || !secret_key) {
                    throw new Error("Required fields secret key and public key");
                }
                try {
                    const userId = ctx.user.userId;
                    return await userAPIKey.createPaymongoAPIKey(Number(userId), { public_key, secret_key });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error saving your API keys");
                    throw new Error("Error saving your API keys");
                }
            }
        });
        t.nonNull.field("updateAPIKey", {
            type: "PaymongoAPIKeys",
            args: {
                public_key: nullable(stringArg()),
                secret_key: nullable(stringArg())
            },
            resolve: async (_, { public_key, secret_key }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN"]);
                if (!public_key && !secret_key) {
                    throw new Error("Required fields at least one of the fields");
                }
                try {
                    const userId = ctx.user.userId;
                    return await userAPIKey.updateAPIKeyByUserId(Number(userId), { public_key, secret_key });
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error updating your API keys");
                    throw new Error("Error updating your API keys");
                }
            }
        });
        t.nonNull.field("addAPIKeysToOutlet", {
            type: "Boolean",
            args: {
                outletId: nonNull(arg({ type: "ID" })),
                apiKeyId: nonNull(arg({ type: "ID" }))
            },
            resolve: async (_, { outletId, apiKeyId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                if (!outletId && !apiKeyId) {
                    throw new Error("Required fields outletId and apiKeyId");
                }
                try {
                    return await userAPIKey.addingAPIKeyToOutlet(Number(outletId), Number(apiKeyId));
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error adding API keys to your outlet");
                    throw new Error("Error adding your API keys to the outlet");
                }
            }
        });
        t.nonNull.field("clearAPIToOutlet", {
            type: "Boolean",
            args: {
                outletId: nonNull(arg({ type: "ID" }))
            },
            resolve: async (_, { outletId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER"]);
                if (!outletId) {
                    throw new Error("Please select an outlet");
                }
                try {
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error Clearing API keys your outlet");
                    throw new Error("Error Clearing your API keys to the outlet");
                }
            }
        });
    }
});
