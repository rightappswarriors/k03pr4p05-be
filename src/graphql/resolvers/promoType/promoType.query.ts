import { extendType, nonNull, list, intArg } from "nexus";
import * as promoTypeService from "../../../services/promoType.service.js";

export const PromoTypeQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("promoTypes", {
      type: "PromoType",
      resolve: async () => {
        return await promoTypeService.getAllPromoTypes();
      },
    });

    t.field("promoType", {
      type: "PromoType",
      args: { id: nonNull(intArg()) },
      resolve: async (_, { id }) => {
        return await promoTypeService.getPromoTypeById(Number(id));
      },
    });

    t.nonNull.list.nonNull.field("promoTypesByOrg", {
      type: "PromoType",
      args: { orgId: nonNull(intArg()) },
      resolve: async (_, { orgId }) => {
        return await promoTypeService.getPromoTypesByOrg(Number(orgId));
      },
    });
  },
});
