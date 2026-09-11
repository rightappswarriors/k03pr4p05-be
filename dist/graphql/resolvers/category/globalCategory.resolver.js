import { arg, booleanArg, extendType, inputObjectType, intArg, nonNull, nullable, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { requireActiveOrganization, requireAdmin } from '../../../lib/adminGovernance.js';
import { sendToOrg } from '../../../lib/ws.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import * as categoryService from '../../../services/globalCategory.service.js';
export const GlobalCategoryInput = inputObjectType({ name: 'GlobalCategoryInput', definition(t) { t.nonNull.string('name'); t.nullable.string('description'); t.nullable.string('parentId'); t.nullable.string('imageUrl'); t.nullable.string('iconUrl'); t.nullable.int('sortOrder'); t.nullable.boolean('isFeatured'); t.nullable.field('status', { type: 'CategoryStatus' }); } });
export const CategorySuggestionApprovalInput = inputObjectType({ name: 'CategorySuggestionApprovalInput', definition(t) { t.nullable.string('name'); t.nullable.string('description'); t.nullable.string('parentId'); t.nullable.string('imageUrl'); t.nullable.string('iconUrl'); t.nullable.int('sortOrder'); t.nullable.boolean('isFeatured'); } });
const categoryFilters = {
    page: nullable(intArg()), limit: nullable(intArg()), search: nullable(stringArg()), status: nullable(arg({ type: 'CategoryStatus' })), parentId: nullable(stringArg()), rootOnly: nullable(booleanArg()), leafOnly: nullable(booleanArg()), isFeatured: nullable(booleanArg()),
};
const suggestionFilters = { page: nullable(intArg()), limit: nullable(intArg()), search: nullable(stringArg()), status: nullable(arg({ type: 'CategorySuggestionStatus' })), parentCategoryId: nullable(stringArg()), from: nullable(stringArg()), to: nullable(stringArg()) };
const ensurePage = (args) => {
    if (args.page != null && (!Number.isInteger(args.page) || args.page < 1))
        throw new Error('Page must be a positive integer.');
    if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100))
        throw new Error('Limit must be between 1 and 100.');
};
export const GlobalCategoryQueries = extendType({ type: 'Query', definition(t) {
        t.nonNull.field('globalCategories', { type: 'CategoryPage', args: categoryFilters, async resolve(_root, args, ctx) { requireAuth(ctx); ensurePage(args); return categoryService.listGlobalCategories(ctx, args); } });
        t.nonNull.list.nonNull.field('categoryTree', { type: 'CategoryTreeNode', async resolve(_root, _args, ctx) { requireAuth(ctx); return categoryService.categoryTree(ctx); } });
        t.nonNull.list.nonNull.field('categoryPlacementSuggestions', { type: 'CategoryPlacementSuggestion', args: { proposedName: nonNull(stringArg()), description: nullable(stringArg()) }, async resolve(_root, { proposedName, description }, ctx) { PAGE_PERMISSIONS.supplierCategories.view(ctx); await requireActiveOrganization(ctx); return categoryService.suggestCategoryPlacement(ctx, proposedName, description); } });
        t.nonNull.field('categorySupplierItemUsage', { type: 'CategorySupplierItemUsage', args: { categoryId: nonNull(stringArg()) }, async resolve(_root, { categoryId }, ctx) {
                PAGE_PERMISSIONS.supplierCategories.view(ctx);
                await requireActiveOrganization(ctx);
                const orgId = Number(ctx.user?.orgId ?? 0);
                if (!orgId)
                    throw new Error('Supplier organization membership is required.');
                const supplierItemCount = await ctx.prisma.supplierItem.count({ where: { globalCategoryId: categoryId, deletedAt: null, catalog: { organizationId: orgId, deletedAt: null } } });
                return { categoryId, supplierItemCount };
            } });
        t.nonNull.field('myCategorySuggestions', { type: 'CategorySuggestionPage', args: suggestionFilters, async resolve(_root, args, ctx) { PAGE_PERMISSIONS.supplierCategories.view(ctx); await requireActiveOrganization(ctx); ensurePage(args); const orgId = Number(ctx.user?.orgId ?? 0); if (!orgId)
                throw new Error('Supplier organization membership is required.'); return categoryService.listCategorySuggestions(ctx, args, orgId); } });
        t.nonNull.field('adminCategorySuggestions', { type: 'CategorySuggestionPage', args: { ...suggestionFilters, organizationId: nullable(intArg()) }, async resolve(_root, args, ctx) { requireAdmin(ctx); ensurePage(args); return categoryService.listCategorySuggestions(ctx, args, args.organizationId ?? undefined); } });
    } });
export const GlobalCategoryMutations = extendType({ type: 'Mutation', definition(t) {
        t.nonNull.field('createGlobalCategory', { type: 'Category', args: { input: nonNull(arg({ type: 'GlobalCategoryInput' })) }, async resolve(_root, { input }, ctx) { requireAdmin(ctx); return categoryService.createGlobalCategory(ctx, input); } });
        t.nonNull.field('updateGlobalCategory', { type: 'Category', args: { id: nonNull(stringArg()), input: nonNull(arg({ type: 'GlobalCategoryInput' })) }, async resolve(_root, { id, input }, ctx) { requireAdmin(ctx); return categoryService.updateGlobalCategory(ctx, id, input); } });
        t.nonNull.field('archiveGlobalCategory', { type: 'Category', args: { id: nonNull(stringArg()) }, async resolve(_root, { id }, ctx) { requireAdmin(ctx); return categoryService.archiveGlobalCategory(ctx, id); } });
        t.nonNull.field('restoreGlobalCategory', { type: 'Category', args: { id: nonNull(stringArg()) }, async resolve(_root, { id }, ctx) { requireAdmin(ctx); return categoryService.archiveGlobalCategory(ctx, id, true); } });
        t.nonNull.field('createCategorySuggestion', { type: 'CategorySuggestionSubmission', args: { proposedName: nonNull(stringArg()), proposedDescription: nullable(stringArg()), parentCategoryId: nullable(stringArg()) }, async resolve(_root, args, ctx) { PAGE_PERMISSIONS.supplierCategories.create(ctx); await requireActiveOrganization(ctx); return categoryService.createCategorySuggestion(ctx, args); } });
        t.nonNull.field('assignSupplierItemGlobalCategory', { type: 'SupplierItem', args: { supplierItemId: nonNull(stringArg()), categoryId: nullable(stringArg()) }, async resolve(_root, { supplierItemId, categoryId }, ctx) {
                PAGE_PERMISSIONS.supplierProducts.edit(ctx);
                await requireActiveOrganization(ctx);
                const orgId = Number(ctx.user?.orgId ?? 0);
                if (!orgId)
                    throw new Error('Supplier organization membership is required.');
                const item = await ctx.prisma.supplierItem.findFirst({ where: { id: supplierItemId, deletedAt: null, catalog: { organizationId: orgId, deletedAt: null } } });
                if (!item)
                    throw new Error('Supplier item not found.');
                if (categoryId) {
                    const category = await ctx.prisma.category.findFirst({ where: { id: categoryId, status: 'ACTIVE', deletedAt: null }, select: { id: true, _count: { select: { children: { where: { status: 'ACTIVE', deletedAt: null } } } } } });
                    if (!category)
                        throw new Error('Global category is not active.');
                    if (category._count.children > 0)
                        throw new Error('Please choose a more specific category.');
                }
                return ctx.prisma.supplierItem.update({ where: { id: supplierItemId }, data: { globalCategoryId: categoryId ?? null } });
            } });
        t.nonNull.field('approveCategorySuggestion', { type: 'CategorySuggestion', args: { id: nonNull(stringArg()), input: nullable(arg({ type: 'CategorySuggestionApprovalInput' })) }, async resolve(_root, { id, input }, ctx) { requireAdmin(ctx); const suggestion = await categoryService.approveCategorySuggestion(ctx, id, input ?? {}); sendToOrg(suggestion.organizationId, 'category:suggestion-reviewed', { suggestionId: suggestion.id, status: suggestion.status }); return suggestion; } });
        t.nonNull.field('rejectCategorySuggestion', { type: 'CategorySuggestion', args: { id: nonNull(stringArg()), rejectionReason: nonNull(stringArg()) }, async resolve(_root, { id, rejectionReason }, ctx) { requireAdmin(ctx); const suggestion = await categoryService.rejectCategorySuggestion(ctx, id, rejectionReason); sendToOrg(suggestion.organizationId, 'category:suggestion-reviewed', { suggestionId: suggestion.id, status: suggestion.status }); return suggestion; } });
        t.nonNull.field('mergeCategorySuggestion', { type: 'CategorySuggestion', args: { id: nonNull(stringArg()), categoryId: nonNull(stringArg()) }, async resolve(_root, { id, categoryId }, ctx) { requireAdmin(ctx); const suggestion = await categoryService.mergeCategorySuggestion(ctx, id, categoryId); sendToOrg(suggestion.organizationId, 'category:suggestion-reviewed', { suggestionId: suggestion.id, status: suggestion.status }); return suggestion; } });
        t.nonNull.field('changeMergedCategorySuggestionTarget', { type: 'CategorySuggestion', args: { id: nonNull(stringArg()), categoryId: nonNull(stringArg()) }, async resolve(_root, { id, categoryId }, ctx) { requireAdmin(ctx); const suggestion = await categoryService.changeMergedCategorySuggestionTarget(ctx, id, categoryId); sendToOrg(suggestion.organizationId, 'category:suggestion-reviewed', { suggestionId: suggestion.id, status: suggestion.status }); return suggestion; } });
        t.nonNull.field('convertMergedCategorySuggestionToCategory', { type: 'CategorySuggestion', args: { id: nonNull(stringArg()), input: nonNull(arg({ type: 'CategorySuggestionApprovalInput' })) }, async resolve(_root, { id, input }, ctx) { requireAdmin(ctx); const suggestion = await categoryService.convertMergedCategorySuggestionToCategory(ctx, id, input); sendToOrg(suggestion.organizationId, 'category:suggestion-reviewed', { suggestionId: suggestion.id, status: suggestion.status }); return suggestion; } });
    } });
