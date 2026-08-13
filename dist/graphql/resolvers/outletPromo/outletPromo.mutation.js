import { extendType, nonNull, inputObjectType, intArg, } from "nexus";
import * as outletPromoService from "../../../services/outletPromo.service.js";
export const CreateOutletPromoInput = inputObjectType({
    name: "CreateOutletPromoInput",
    definition(t) {
        t.nonNull.int("outletId");
        t.nonNull.int("promoTypeId");
        t.nonNull.float("discount");
        t.nonNull.int("userId");
        t.nullable.boolean("isActive");
    },
});
export const UpdateOutletPromoInput = inputObjectType({
    name: "UpdateOutletPromoInput",
    definition(t) {
        t.nullable.float("discount");
        t.nullable.boolean("isActive");
    },
});
export const OutletPromoMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("createOutletPromo", {
            type: "OutletPromo",
            args: { data: nonNull(CreateOutletPromoInput) },
            resolve: async (_, { data }, ctx) => {
                return outletPromoService.createOutletPromo({
                    outletId: data.outletId,
                    promoTypeId: data.promoTypeId,
                    discount: data.discount,
                    userId: data.userId,
                    isActive: data.isActive ?? true,
                });
            },
        });
        t.nonNull.field("updateOutletPromo", {
            type: "OutletPromo",
            args: {
                id: nonNull(intArg()),
                data: nonNull(UpdateOutletPromoInput),
            },
            resolve: async (_, { id, data }, ctx) => {
                return outletPromoService.updateOutletPromo(Number(id), {
                    discount: data.discount,
                    isActive: data.isActive,
                });
            },
        });
        t.nonNull.field("deleteOutletPromo", {
            type: "OutletPromo",
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                return outletPromoService.deleteOutletPromo(Number(id));
            },
        });
    },
});
