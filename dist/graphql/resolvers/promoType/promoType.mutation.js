import { extendType, nonNull, inputObjectType, intArg } from "nexus";
import * as promoTypeService from "../../../services/promoType.service.js";
export const CreatePromoTypeInput = inputObjectType({
    name: "CreatePromoTypeInput",
    definition(t) {
        t.nonNull.string("name");
        t.nullable.string("description");
        t.nullable.boolean("isActive");
        t.nonNull.int("orgId");
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
            resolve: async (_, { data }) => {
                return await promoTypeService.createPromoType({
                    name: data.name,
                    description: data.description,
                    isActive: data.isActive ?? true,
                    orgId: data.orgId,
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
            resolve: async (_, { id, data }) => {
                return await promoTypeService.updatePromoType(Number(id), {
                    name: data.name,
                    description: data.description,
                    isActive: data.isActive,
                });
            },
        });
        t.nonNull.field("deletePromoType", {
            type: "PromoType",
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }) => {
                return await promoTypeService.deletePromoType(Number(id));
            },
        });
    },
});
