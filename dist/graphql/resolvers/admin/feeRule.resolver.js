import { arg, booleanArg, extendType, floatArg, nonNull, nullable, stringArg } from 'nexus';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
function validate(rate, effectiveFrom, effectiveTo) {
    if (!Number.isFinite(rate) || rate < 0)
        throw new Error('Fee rate must be a non-negative number.');
    if (effectiveTo && effectiveTo < effectiveFrom)
        throw new Error('Effective-to date must not precede effective-from date.');
}
async function assertNoActiveConflict(ctx, input, effectiveFrom, effectiveTo, excludeId) {
    if (input.isActive === false)
        return;
    const candidates = await ctx.prisma.feeRule.findMany({ where: {
            appliesTo: input.appliesTo, category: input.category ?? null, unitType: input.unitType ?? null,
            isActive: true, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}),
        } });
    const overlaps = candidates.some((rule) => rule.effectiveFrom <= (effectiveTo ?? new Date('9999-12-31')) && (rule.effectiveTo ?? new Date('9999-12-31')) >= effectiveFrom);
    if (overlaps)
        throw new Error('An active fee rule with the same scope already overlaps this effective period. Deactivate or end-date it first.');
}
function feeArgs() {
    return {
        appliesTo: nonNull(arg({ type: 'FeeApplication' })), rateType: nonNull(arg({ type: 'FeeRateType' })), rate: nonNull(floatArg()),
        category: nullable(stringArg()), unitType: nullable(stringArg()), tierModifier: nullable(floatArg()),
        effectiveFrom: nonNull(arg({ type: 'DateTime' })), effectiveTo: nullable(arg({ type: 'DateTime' })), isActive: booleanArg(),
    };
}
export const feeRuleAdminQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('listFeeRules', {
            type: 'FeeRule',
            resolve: (_, __, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.feeConfig.view(ctx);
                return ctx.prisma.feeRule.findMany({ where: { deletedAt: null }, orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }] });
            },
        });
        t.nullable.field('getFeeRule', {
            type: 'FeeRule', args: { id: nonNull(stringArg()) },
            resolve: (_, { id }, ctx) => { requireAuth(ctx); PAGE_PERMISSIONS.feeConfig.view(ctx); return ctx.prisma.feeRule.findFirst({ where: { id, deletedAt: null } }); },
        });
    },
});
export const feeRuleAdminMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('createFeeRule', {
            type: 'FeeRule', args: feeArgs(),
            resolve: async (_, input, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.feeConfig.create(ctx);
                const effectiveFrom = new Date(input.effectiveFrom);
                const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
                validate(input.rate, effectiveFrom, effectiveTo);
                await assertNoActiveConflict(ctx, input, effectiveFrom, effectiveTo);
                const rule = await ctx.prisma.feeRule.create({ data: { ...input, effectiveFrom, effectiveTo, isActive: input.isActive ?? true } });
                await ctx.prisma.auditLog.create({ data: { orgId: Number(ctx.user.orgId), userId: ctx.user.id, pageKey: 'feeConfigPage', action: 'CREATE', recordId: rule.id, recordType: 'FeeRule', newValue: rule } });
                return rule;
            },
        });
        t.nonNull.field('updateFeeRule', {
            type: 'FeeRule', args: { id: nonNull(stringArg()), ...feeArgs() },
            resolve: async (_, { id, ...input }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.feeConfig.edit(ctx);
                const previous = await ctx.prisma.feeRule.findFirstOrThrow({ where: { id, deletedAt: null } });
                const effectiveFrom = new Date(input.effectiveFrom);
                const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
                validate(input.rate, effectiveFrom, effectiveTo);
                await assertNoActiveConflict(ctx, input, effectiveFrom, effectiveTo, id);
                const rule = await ctx.prisma.feeRule.update({ where: { id }, data: { ...input, effectiveFrom, effectiveTo, isActive: input.isActive ?? previous.isActive } });
                await ctx.prisma.auditLog.create({ data: { orgId: Number(ctx.user.orgId), userId: ctx.user.id, pageKey: 'feeConfigPage', action: 'EDIT', recordId: rule.id, recordType: 'FeeRule', oldValue: previous, newValue: rule } });
                return rule;
            },
        });
        t.nonNull.field('toggleFeeRule', {
            type: 'FeeRule', args: { id: nonNull(stringArg()), isActive: nonNull(booleanArg()) },
            resolve: async (_, { id, isActive }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.feeConfig.edit(ctx);
                const previous = await ctx.prisma.feeRule.findFirstOrThrow({ where: { id, deletedAt: null } });
                const rule = await ctx.prisma.feeRule.update({ where: { id }, data: { isActive } });
                await ctx.prisma.auditLog.create({ data: { orgId: Number(ctx.user.orgId), userId: ctx.user.id, pageKey: 'feeConfigPage', action: 'STATUS_CHANGE', recordId: rule.id, recordType: 'FeeRule', oldValue: { isActive: previous.isActive }, newValue: { isActive } } });
                return rule;
            },
        });
    },
});
