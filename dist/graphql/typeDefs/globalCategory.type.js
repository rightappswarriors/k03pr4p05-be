import { enumType, objectType } from 'nexus';
export const CategoryStatus = enumType({ name: 'CategoryStatus', members: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] });
export const CategorySuggestionStatus = enumType({ name: 'CategorySuggestionStatus', members: ['PENDING', 'APPROVED', 'REJECTED', 'MERGED'] });
export const Category = objectType({
    name: 'Category',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nonNull.string('slug');
        t.nullable.string('description');
        t.nullable.string('parentId');
        t.nullable.string('imageUrl');
        t.nullable.string('iconUrl');
        t.nonNull.int('sortOrder');
        t.nonNull.boolean('isFeatured');
        t.nonNull.field('status', { type: 'CategoryStatus' });
        t.nullable.int('createdByUserId');
        t.nullable.int('reviewedByUserId');
        t.nullable.dateTime('reviewedAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
    },
});
export const CategoryTreeNode = objectType({
    name: 'CategoryTreeNode',
    definition(t) { t.nonNull.string('id'); t.nonNull.string('name'); t.nonNull.string('slug'); t.nullable.string('parentId'); t.nonNull.int('depth'); t.nonNull.boolean('hasChildren'); t.nonNull.int('sortOrder'); },
});
export const CategoryPage = objectType({ name: 'CategoryPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'Category' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages'); } });
export const CategorySuggestion = objectType({
    name: 'CategorySuggestion',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('proposedName');
        t.nullable.string('proposedDescription');
        t.nullable.string('parentCategoryId');
        t.nonNull.int('organizationId');
        t.nullable.int('submittedByUserId');
        t.nonNull.field('status', { type: 'CategorySuggestionStatus' });
        t.nullable.int('reviewedByUserId');
        t.nullable.dateTime('reviewedAt');
        t.nullable.string('rejectionReason');
        t.nullable.string('approvedCategoryId');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.field('parentCategory', { type: 'Category' });
        t.nullable.field('approvedCategory', { type: 'Category' });
        t.nonNull.field('organization', { type: 'Organization' });
    },
});
export const CategorySuggestionPage = objectType({ name: 'CategorySuggestionPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'CategorySuggestion' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages'); } });
export const CategorySuggestionSubmission = objectType({ name: 'CategorySuggestionSubmission', definition(t) { t.nonNull.field('suggestion', { type: 'CategorySuggestion' }); t.nonNull.list.nonNull.field('possibleDuplicates', { type: 'Category' }); } });
export const CategorySupplierItemUsage = objectType({ name: 'CategorySupplierItemUsage', definition(t) { t.nonNull.string('categoryId'); t.nonNull.int('supplierItemCount'); } });
export const CategoryPlacementSuggestion = objectType({ name: 'CategoryPlacementSuggestion', definition(t) { t.nonNull.string('id'); t.nonNull.string('name'); t.nullable.string('parentId'); t.nonNull.string('breadcrumb'); t.nonNull.int('depth'); t.nonNull.int('score'); t.nonNull.string('reason'); } });
