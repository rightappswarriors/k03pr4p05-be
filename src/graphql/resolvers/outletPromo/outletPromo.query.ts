import { extendType, nonNull, list, intArg } from "nexus";
import * as outletPromoService from "../../../services/outletPromo.service.js";

export const OutletPromoQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("outletPromos", {
      type: "OutletPromo",
      resolve: async (_, __, ctx) => {
        return await outletPromoService.getAllOutletPromos();
      },
    });

    t.field("outletPromo", {
      type: "OutletPromo",
      args: { id: nonNull(intArg()) },
      resolve: async (_, { id }, ctx) => {
        return await outletPromoService.getOutletPromoById(Number(id));
      },
    });

    t.nonNull.list.nonNull.field("outletPromosByOutlet", {
      type: "OutletPromo",
      args: { outletId: nonNull(intArg()) },
      resolve: async (_, { outletId }, ctx) => {
        return await outletPromoService.getOutletPromosByOutletId(Number(outletId));
      },
    });

    t.nonNull.list.nonNull.field("outletPromosByPromoType", {
      type: "OutletPromo",
      args: { promoTypeId: nonNull(intArg()) },
      resolve: async (_, { promoTypeId }, ctx) => {
        return await outletPromoService.getOutletPromosByPromoTypeId(Number(promoTypeId));
      },
    });
  },
});
