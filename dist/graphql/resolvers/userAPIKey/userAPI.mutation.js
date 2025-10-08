import { extendType, nonNull, stringArg, nullable } from "nexus";
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
                    console.error("Error updating your API keys");
                    throw new Error("Error updating your API keys");
                }
            }
        });
    }
});
