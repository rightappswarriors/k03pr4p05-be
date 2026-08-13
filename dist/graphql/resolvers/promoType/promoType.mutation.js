import { extendType, nonNull, inputObjectType, intArg } from "nexus";
import * as promoTypeService from "../../../services/promoType.service.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
export const CreatePromoTypeInput = inputObjectType({
    name: "CreatePromoTypeInput",
    definition(t) {
        t.nonNull.string("name");
        t.nullable.string("description");
        t.nullable.boolean("isActive");
        t.nullable.int("userId");
    },
});
export const UpdatePromoTypeInput = inputObjectType({
    name: "UpdatePromoTypeInput",
    definition(t) {
        t.nullable.string("name");
        t.nullable.string("description");
        t.nullable.boolean("isActive");
    },
});
export const PromoTypeMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("createPromoType", {
            type: "PromoType",
            args: { data: nonNull(CreatePromoTypeInput) },
            resolve: async (_, { data }, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return await promoTypeService.createPromoType({
                    name: data.name,
                    description: data.description,
                    isActive: data.isActive ?? true,
                    orgId: orgId,
                    userId: data.userId ?? null,
                });
            },
        });
        t.nonNull.field("updatePromoType", {
            type: "PromoType",
            args: {
                id: nonNull(intArg()),
                data: nonNull(UpdatePromoTypeInput),
            },
            resolve: async (_, { id, data }, ctx) => {
                const orgId = Number(ctx.user?.orgId);
                requireAuth(ctx);
                return await promoTypeService.updatePromoType(Number(id), orgId, {
                    name: data.name,
                    description: data.description,
                    isActive: data.isActive,
                });
            },
        });
        t.nonNull.field("deletePromoType", {
            type: "PromoType",
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return await promoTypeService.deletePromoType(Number(id), orgId);
            },
        });
    },
});
