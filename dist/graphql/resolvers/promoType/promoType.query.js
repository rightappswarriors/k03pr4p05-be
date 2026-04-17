import { extendType, nonNull, intArg } from "nexus";
import * as promoTypeService from "../../../services/promoType.service.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
export const PromoTypeQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("promoTypes", {
            type: "PromoType",
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return await promoTypeService.getAllPromoTypes(orgId);
            },
        });
        t.field("promoType", {
            type: "PromoType",
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return await promoTypeService.getPromoTypeById(Number(id), orgId);
            },
        });
        t.nonNull.list.nonNull.field("promoTypesByOrg", {
            type: "PromoType",
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return await promoTypeService.getPromoTypesByOrg(orgId);
            },
        });
    },
});
