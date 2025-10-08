import { extendType } from "nexus";
import * as userAPIKey from "../../../services/userAPI.service.js";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
export const APIKeyQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.field("getAPIKeysByUserId", {
            type: "PaymongoAPIKeys",
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                try {
                    const userId = ctx.user.userId;
                    return await userAPIKey.getUserAPIKeyByUserId(Number(userId));
                }
                catch (error) {
                    console.error("Error getting your API keys.");
                    throw new Error("Error getting your api key");
                }
            }
        });
    }
});
