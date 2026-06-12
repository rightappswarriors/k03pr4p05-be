import { arg, extendType, intArg, stringArg, floatArg, booleanArg, nonNull } from 'nexus'

export const summaryRowMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createSummaryRow', {
      type: 'SummaryRow',
      args: {
        orgId: nonNull(intArg()),
        accountTitleId: nonNull(intArg()),
        vatTypeId: nonNull(intArg()),
        centerId: nonNull(intArg()),
        subCenterId: nonNull(intArg()),
        itemId: intArg(),
        itemName: stringArg(),
        costLines: arg({ type: 'Json' }),
        costInputAmount: floatArg(),
        costInputVatInclusive: nonNull(booleanArg()),
        sellingPriceInput: floatArg(),
        sellingPriceVatInclusive: nonNull(booleanArg()),
        opExPct: nonNull(floatArg()),
        description: stringArg(),
        itemCode: stringArg(),
      },
      resolve: async (
        _,
        {
          orgId,
          accountTitleId,
          vatTypeId,
          centerId,
          subCenterId,
          itemId,
          itemName,
          costLines,
          costInputAmount,
          costInputVatInclusive,
          sellingPriceInput,
          sellingPriceVatInclusive,
          opExPct,
          description,
          itemCode,
        },
        ctx,
      ) => {
        const vatType = await ctx.prisma.vatType.findUnique({
          where: { id: vatTypeId },
        });
        const rate = vatType?.rate ?? 0;

        const costLinesArray = Array.isArray(costLines) ? costLines : [];
        const costInput =
          costLinesArray.length > 0
            ? costLinesArray.reduce(
                (sum, line) => sum + (Number(line?.amount) || 0),
                0,
              )
            : costInputAmount ?? 0;
        const baseCost = costInputVatInclusive
          ? costInput / (1 + rate)
          : costInput;
        const vatInput = costInputVatInclusive
          ? costInput - baseCost
          : baseCost * rate;

        const revInput = sellingPriceInput ?? 0;
        const sellingPrice = sellingPriceVatInclusive
          ? revInput / (1 + rate)
          : revInput;
        const vatOutput = sellingPriceVatInclusive
          ? revInput - sellingPrice
          : sellingPrice * rate;

        const opExAmount = sellingPrice * opExPct;
        const grossProfit = sellingPrice - baseCost;
        const netProfit = grossProfit - opExAmount;
        const status = netProfit >= 0 ? 'INCOME' : 'LOSS';

        return ctx.prisma.summaryRow.create({
          data: {
            orgId,
            accountTitleId,
            vatTypeId,
            centerId,
            subCenterId,
            itemId: itemId ?? null,
            itemName: itemName ?? '',
            amount: costInput,
            description: description ?? '',
            itemCode: itemCode ?? '',
            costLines: costLinesArray,
            baseCost,
            vatInput,
            sellingPrice,
            vatOutput,
            opExPct,
            opExAmount,
            grossProfit,
            netProfit,
            status,
            computedCost: baseCost,
            costContribution: baseCost,
          },
          include: {
            item: true,
            accountTitle: true,
            center: true,
            subCenter: true,
            vatType: true,
            org: true,
          },
        });
      },
    })

    // updateSummaryRow and deleteSummaryRow stay mostly the same,
    // just add status recomputation in update:
    t.field('updateSummaryRow', {
      type: 'SummaryRow',
      args: {
        id: nonNull(intArg()),
        accountTitleId: intArg(),
        vatTypeId: intArg(),
        centerId: intArg(),
        subCenterId: intArg(),
        itemId: intArg(),
        itemName: stringArg(),
        costLines: arg({ type: 'Json' }),
        costInputAmount: floatArg(),
        costInputVatInclusive: booleanArg(),
        sellingPriceInput: floatArg(),
        sellingPriceVatInclusive: booleanArg(),
        opExPct: floatArg(),
        description: stringArg(),
        itemCode: stringArg(),
      },
      resolve: async (
        _,
        {
          id,
          accountTitleId,
          vatTypeId,
          centerId,
          subCenterId,
          itemId,
          itemName,
          costLines,
          costInputAmount,
          costInputVatInclusive,
          sellingPriceInput,
          sellingPriceVatInclusive,
          opExPct,
          description,
          itemCode,
        },
        ctx,
      ) => {
        const existing = await ctx.prisma.summaryRow.findUnique({ where: { id } });
        if (!existing) {
          throw new Error('SummaryRow not found');
        }

        const finalVatTypeId = vatTypeId ?? existing.vatTypeId;
        const vatType = await ctx.prisma.vatType.findUnique({
          where: { id: finalVatTypeId },
        });
        const rate = vatType?.rate ?? 0;

        const existingCostLines =
          (existing.costLines ?? []) as Array<{ amount?: number }>;
        const incomingCostLines =
          costLines !== undefined && Array.isArray(costLines)
            ? (costLines as Array<{ amount?: number }>)
            : existingCostLines;
        const costInput =
          incomingCostLines.length > 0
            ? incomingCostLines.reduce(
                (sum: number, line: { amount?: number }) =>
                  sum + (Number(line?.amount) || 0),
                0,
              )
            : costInputAmount !== undefined
              ? costInputAmount
              : existing.amount;
        const costVatInclusive =
          costInputVatInclusive !== undefined
            ? costInputVatInclusive
            : existing.vatInput !== null && existing.vatInput > 0;
        const baseCost = costVatInclusive
          ? costInput / (1 + rate)
          : costInput;
        const vatInput = costVatInclusive
          ? costInput - baseCost
          : baseCost * rate;

        const revenueInput =
          sellingPriceInput !== undefined
            ? sellingPriceInput
            : existing.sellingPrice + (existing.vatOutput ?? 0);
        const revenueVatInclusive =
          sellingPriceVatInclusive !== undefined
            ? sellingPriceVatInclusive
            : existing.vatOutput !== null && existing.vatOutput > 0;
        const sellingPrice = revenueVatInclusive
          ? revenueInput / (1 + rate)
          : revenueInput;
        const vatOutput = revenueVatInclusive
          ? revenueInput - sellingPrice
          : sellingPrice * rate;

        const finalOpExPct =
          opExPct !== undefined ? opExPct : existing.opExPct;
        const opExAmount = sellingPrice * finalOpExPct;
        const grossProfit = sellingPrice - baseCost;
        const netProfit = grossProfit - opExAmount;
        const status = netProfit >= 0 ? 'INCOME' : 'LOSS';

        return ctx.prisma.summaryRow.update({
          where: { id },
          data: {
            ...(accountTitleId !== undefined && { accountTitleId }),
            ...(vatTypeId !== undefined && { vatTypeId }),
            ...(centerId !== undefined && { centerId }),
            ...(subCenterId !== undefined && { subCenterId }),
            ...(itemId !== undefined && { itemId }),
            ...(itemName !== undefined && { itemName }),
            ...(description !== undefined && { description }),
            ...(itemCode !== undefined && { itemCode }),
            ...(costLines !== undefined && { costLines: incomingCostLines }),
            baseCost,
            vatInput,
            sellingPrice,
            vatOutput,
            opExPct: finalOpExPct,
            opExAmount,
            grossProfit,
            netProfit,
            status,
            amount: costInput,
            computedCost: baseCost,
            costContribution: baseCost,
          },
        });
      },
    })

    t.field('deleteSummaryRow', {
      type: 'SummaryRow',
      args: { id: nonNull(intArg()) },
      resolve: async (_, { id }, ctx) =>
        ctx.prisma.summaryRow.update({
          where: { id: id! },
          data: { deletedAt: new Date() },
        })
    })
  }
})
