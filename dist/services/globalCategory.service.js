const MAX_DEPTH = 2;
const AMBIGUOUS_LEGACY_NAMES = new Set(['other', 'others', 'misc', 'general', 'products']);
const actorId = (ctx) => Number(ctx.user?.id ?? ctx.user?.userId ?? 0);
export const normalizeCategoryName = (value) => value.trim().replace(/\s+/g, ' ');
export const normalizeCategoryKey = (value) => normalizeCategoryName(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const isAmbiguousLegacyCategoryName = (value) => AMBIGUOUS_LEGACY_NAMES.has(normalizeCategoryKey(value));
const slugBase = (name) => normalizeCategoryKey(name).replace(/\s+/g, '-').replace(/(^-|-$)/g, '') || 'category';
async function uniqueSlug(tx, name, excludedId) {
    const base = slugBase(name);
    let candidate = base;
    let suffix = 2;
    while (await tx.category.findFirst({ where: { slug: candidate, ...(excludedId ? { id: { not: excludedId } } : {}) }, select: { id: true } })) {
        candidate = `${base}-${suffix++}`;
    }
    return candidate;
}
async function parentDepth(tx, parentId, excludedId) {
    if (!parentId)
        return -1;
    let depth = 0;
    let currentId = parentId;
    const visited = new Set();
    while (currentId) {
        if (visited.has(currentId) || currentId === excludedId)
            throw new Error('Category hierarchy cannot contain a circular parent relationship.');
        visited.add(currentId);
        const category = await tx.category.findUnique({ where: { id: currentId }, select: { parentId: true, deletedAt: true, status: true } });
        if (!category || category.deletedAt || category.status !== 'ACTIVE')
            throw new Error('Parent category must be active.');
        depth += 1;
        currentId = category.parentId;
    }
    return depth - 1;
}
async function assertParent(tx, parentId, excludedId) {
    if (!parentId)
        return;
    const depth = await parentDepth(tx, parentId, excludedId);
    if (depth >= MAX_DEPTH)
        throw new Error('Categories support a maximum of three levels.');
}
async function audit(tx, ctx, pageKey, action, recordType, recordId, extra = {}) {
    const userId = actorId(ctx);
    if (!userId)
        return;
    await tx.auditLog.create({ data: { orgId: Number(ctx.user?.orgId ?? 0), userId, pageKey, action: 'STATUS_CHANGE', recordType, recordId, newValue: { action, ...extra } } });
}
export async function createGlobalCategory(ctx, input) {
    const name = normalizeCategoryName(input.name);
    if (!name)
        throw new Error('Category name is required.');
    return ctx.prisma.$transaction(async (tx) => {
        await assertParent(tx, input.parentId);
        const sibling = await tx.category.findFirst({ where: { parentId: input.parentId ?? null, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
        if (sibling)
            throw new Error('A category with this name already exists under the selected parent.');
        const category = await tx.category.create({ data: { name, slug: await uniqueSlug(tx, name), description: input.description?.trim() || null, parentId: input.parentId ?? null, imageUrl: input.imageUrl?.trim() || null, iconUrl: input.iconUrl?.trim() || null, sortOrder: input.sortOrder ?? 0, isFeatured: input.isFeatured ?? false, createdByUserId: actorId(ctx) || null } });
        await audit(tx, ctx, 'globalCategories', 'CATEGORY_CREATED', 'Category', category.id, { categoryId: category.id });
        return category;
    });
}
export async function updateGlobalCategory(ctx, id, input) {
    return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.category.findUnique({ where: { id } });
        if (!existing || existing.deletedAt)
            throw new Error('Category not found.');
        if (existing.status === 'ARCHIVED')
            throw new Error('Archived categories must be restored before editing.');
        const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
        if (parentId === id)
            throw new Error('A category cannot be its own parent.');
        await assertParent(tx, parentId, id);
        const name = input.name === undefined ? existing.name : normalizeCategoryName(input.name);
        if (!name)
            throw new Error('Category name is required.');
        const sibling = await tx.category.findFirst({ where: { id: { not: id }, parentId: parentId ?? null, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
        if (sibling)
            throw new Error('A category with this name already exists under the selected parent.');
        const category = await tx.category.update({ where: { id }, data: { name, slug: name === existing.name ? existing.slug : await uniqueSlug(tx, name, id), description: input.description === undefined ? existing.description : input.description?.trim() || null, parentId: parentId ?? null, imageUrl: input.imageUrl === undefined ? existing.imageUrl : input.imageUrl?.trim() || null, iconUrl: input.iconUrl === undefined ? existing.iconUrl : input.iconUrl?.trim() || null, sortOrder: input.sortOrder ?? existing.sortOrder, isFeatured: input.isFeatured ?? existing.isFeatured, status: input.status ?? existing.status, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        await audit(tx, ctx, 'globalCategories', 'CATEGORY_UPDATED', 'Category', id, { categoryId: id });
        return category;
    });
}
export async function archiveGlobalCategory(ctx, id, restore = false) {
    const category = await ctx.prisma.category.findUnique({ where: { id } });
    if (!category)
        throw new Error('Category not found.');
    const updated = await ctx.prisma.category.update({ where: { id }, data: restore ? { status: 'ACTIVE', deletedAt: null, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } : { status: 'ARCHIVED', deletedAt: new Date(), reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
    await audit(ctx.prisma, ctx, 'globalCategories', restore ? 'CATEGORY_RESTORED' : 'CATEGORY_ARCHIVED', 'Category', id, { categoryId: id });
    return updated;
}
export async function listGlobalCategories(ctx, filters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 30));
    const where = { deletedAt: filters.status === 'ARCHIVED' ? { not: null } : null };
    if (filters.search?.trim())
        where.name = { contains: filters.search.trim(), mode: 'insensitive' };
    if (filters.status)
        where.status = filters.status;
    if (filters.parentId !== undefined)
        where.parentId = filters.parentId || null;
    if (filters.rootOnly)
        where.parentId = null;
    if (filters.isFeatured !== undefined && filters.isFeatured !== null)
        where.isFeatured = filters.isFeatured;
    if (filters.leafOnly)
        where.children = { none: { deletedAt: null } };
    const [items, total] = await Promise.all([ctx.prisma.category.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip: (page - 1) * limit, take: limit }), ctx.prisma.category.count({ where })]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
export async function categoryTree(ctx) {
    const categories = await ctx.prisma.category.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, slug: true, parentId: true, sortOrder: true, _count: { select: { children: { where: { status: 'ACTIVE', deletedAt: null } } } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const categoryRows = categories;
    const byId = new Map(categoryRows.map((category) => [category.id, category]));
    return categoryRows.map((category) => {
        let depth = 0;
        let parentId = category.parentId;
        const visited = new Set();
        while (parentId && byId.has(parentId) && !visited.has(parentId)) {
            visited.add(parentId);
            depth += 1;
            parentId = byId.get(parentId)?.parentId ?? null;
        }
        return { id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, depth, hasChildren: category._count.children > 0, sortOrder: category.sortOrder };
    });
}
export async function suggestCategoryPlacement(ctx, proposedName, description) {
    const searchTerms = new Set(normalizeCategoryKey(`${proposedName} ${description ?? ''}`).split(' ').filter((term) => term.length > 1));
    if (!searchTerms.size)
        return [];
    const categories = await ctx.prisma.category.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, parentId: true, sortOrder: true } });
    const byId = new Map(categories.map((category) => [category.id, category]));
    return categories.map((category) => {
        const names = [];
        let current = category;
        const visited = new Set();
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            names.unshift(current.name);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        const haystack = normalizeCategoryKey(`${category.name} ${names.join(' ')}`);
        const matchedTerms = [...searchTerms].filter((term) => haystack.includes(term));
        const nameMatch = normalizeCategoryKey(category.name) === normalizeCategoryKey(proposedName);
        const score = (nameMatch ? 100 : 0) + matchedTerms.length * 12 + (category.parentId ? 1 : 0);
        return { id: category.id, name: category.name, parentId: category.parentId, breadcrumb: names.join(' › '), depth: names.length - 1, score, reason: nameMatch ? 'Name match' : matchedTerms.length ? `Matches ${matchedTerms.slice(0, 2).join(', ')}` : 'Related category' };
    }).filter((category) => category.score > 0).sort((a, b) => b.score - a.score || a.depth - b.depth || a.name.localeCompare(b.name)).slice(0, 8);
}
export async function createCategorySuggestion(ctx, input) {
    const orgId = Number(ctx.user?.orgId ?? 0);
    if (!orgId)
        throw new Error('Supplier organization membership is required.');
    const organization = await ctx.prisma.organization.findFirst({ where: { id: orgId, deletedAt: null, accountStatus: 'ACTIVE', roles: { has: 'SUPPLIER' } }, select: { id: true } });
    if (!organization)
        throw new Error('An active supplier organization is required.');
    const proposedName = normalizeCategoryName(input.proposedName);
    if (!proposedName)
        throw new Error('Suggested category name is required.');
    if (input.parentCategoryId)
        await assertParent(ctx.prisma, input.parentCategoryId);
    const duplicates = await ctx.prisma.category.findMany({ where: { parentId: input.parentCategoryId ?? null, deletedAt: null, name: { equals: proposedName, mode: 'insensitive' } }, select: { id: true, name: true, slug: true } });
    const suggestion = await ctx.prisma.categorySuggestion.create({ data: { proposedName, proposedDescription: input.proposedDescription?.trim() || null, parentCategoryId: input.parentCategoryId ?? null, organizationId: orgId, submittedByUserId: actorId(ctx) || null } });
    await audit(ctx.prisma, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_CREATED', 'CategorySuggestion', suggestion.id, { suggestionId: suggestion.id, organizationId: orgId });
    return { suggestion, possibleDuplicates: duplicates };
}
async function reviewSuggestion(ctx, id, review) {
    return ctx.prisma.$transaction(async (tx) => {
        const suggestion = await tx.categorySuggestion.findUnique({ where: { id } });
        if (!suggestion || suggestion.deletedAt)
            throw new Error('Category suggestion not found.');
        if (suggestion.status !== 'PENDING')
            throw new Error('Only pending category suggestions may be reviewed.');
        return review(tx, suggestion);
    });
}
export async function approveCategorySuggestion(ctx, id, input = {}) {
    return reviewSuggestion(ctx, id, async (tx, suggestion) => {
        const name = input.name === undefined ? suggestion.proposedName : normalizeCategoryName(input.name);
        const parentId = input.parentId === undefined ? suggestion.parentCategoryId : input.parentId;
        if (!name)
            throw new Error('Category name is required.');
        await assertParent(tx, parentId);
        const duplicate = await tx.category.findFirst({ where: { parentId: parentId ?? null, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
        if (duplicate)
            throw new Error('An equivalent category already exists. Merge this suggestion instead.');
        const category = await tx.category.create({ data: { name, slug: await uniqueSlug(tx, name), description: input.description === undefined ? suggestion.proposedDescription : input.description?.trim() || null, parentId: parentId ?? null, imageUrl: input.imageUrl?.trim() || null, iconUrl: input.iconUrl?.trim() || null, sortOrder: input.sortOrder ?? 0, isFeatured: input.isFeatured ?? false, createdByUserId: actorId(ctx) || null, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        const updated = await tx.categorySuggestion.update({ where: { id }, data: { status: 'APPROVED', approvedCategoryId: category.id, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        await audit(tx, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_RESOLUTION_CHANGED', 'CategorySuggestion', id, {
            suggestionId: id,
            oldStatus: suggestion.status,
            oldApprovedCategoryId: suggestion.approvedCategoryId,
            newStatus: updated.status,
            newApprovedCategoryId: category.id,
            newParentCategoryId: parentId ?? null,
            actor: actorId(ctx) || null,
            timestamp: new Date().toISOString(),
        });
        return updated;
    });
}
export async function rejectCategorySuggestion(ctx, id, reason) {
    const rejectionReason = reason.trim();
    if (rejectionReason.length < 5 || rejectionReason.length > 500)
        throw new Error('Rejection reason must be between 5 and 500 characters.');
    return reviewSuggestion(ctx, id, async (tx) => { const updated = await tx.categorySuggestion.update({ where: { id }, data: { status: 'REJECTED', rejectionReason, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } }); await audit(tx, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_REJECTED', 'CategorySuggestion', id, { suggestionId: id }); return updated; });
}
export async function mergeCategorySuggestion(ctx, id, categoryId) {
    return reviewSuggestion(ctx, id, async (tx, suggestion) => { const category = await tx.category.findFirst({ where: { id: categoryId, status: 'ACTIVE', deletedAt: null } }); if (!category)
        throw new Error('Target category is not active.'); const updated = await tx.categorySuggestion.update({ where: { id }, data: { status: 'MERGED', approvedCategoryId: categoryId, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } }); await audit(tx, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_RESOLUTION_CHANGED', 'CategorySuggestion', id, { suggestionId: id, oldStatus: suggestion.status, oldApprovedCategoryId: suggestion.approvedCategoryId, newStatus: updated.status, newApprovedCategoryId: categoryId, newParentCategoryId: category.parentId, actor: actorId(ctx) || null, timestamp: new Date().toISOString() }); return updated; });
}
export async function changeMergedCategorySuggestionTarget(ctx, id, categoryId) {
    return ctx.prisma.$transaction(async (tx) => {
        const suggestion = await tx.categorySuggestion.findUnique({ where: { id } });
        if (!suggestion || suggestion.deletedAt)
            throw new Error('Category suggestion not found.');
        if (suggestion.status !== 'MERGED')
            throw new Error('Only merged category suggestions may change their existing-category target.');
        const category = await tx.category.findFirst({ where: { id: categoryId, status: 'ACTIVE', deletedAt: null } });
        if (!category)
            throw new Error('Target category is not active.');
        const updated = await tx.categorySuggestion.update({ where: { id }, data: { approvedCategoryId: categoryId, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        await audit(tx, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_RESOLUTION_CHANGED', 'CategorySuggestion', id, {
            suggestionId: id,
            oldStatus: suggestion.status,
            oldApprovedCategoryId: suggestion.approvedCategoryId,
            newStatus: updated.status,
            newApprovedCategoryId: categoryId,
            newParentCategoryId: category.parentId,
            actor: actorId(ctx) || null,
            timestamp: new Date().toISOString(),
        });
        return updated;
    });
}
export async function convertMergedCategorySuggestionToCategory(ctx, id, input) {
    return ctx.prisma.$transaction(async (tx) => {
        const suggestion = await tx.categorySuggestion.findUnique({ where: { id } });
        if (!suggestion || suggestion.deletedAt)
            throw new Error('Category suggestion not found.');
        if (suggestion.status !== 'MERGED')
            throw new Error('Only merged category suggestions may be converted into a new category.');
        const name = input.name === undefined ? suggestion.proposedName : normalizeCategoryName(input.name);
        const parentId = input.parentId;
        if (!name)
            throw new Error('Category name is required.');
        if (!parentId)
            throw new Error('Select a parent category for the new category.');
        await assertParent(tx, parentId);
        const duplicate = await tx.category.findFirst({ where: { parentId, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
        if (duplicate)
            throw new Error('An equivalent category already exists under the selected parent.');
        const category = await tx.category.create({ data: { name, slug: await uniqueSlug(tx, name), description: input.description === undefined ? suggestion.proposedDescription : input.description?.trim() || null, parentId, imageUrl: input.imageUrl?.trim() || null, iconUrl: input.iconUrl?.trim() || null, sortOrder: input.sortOrder ?? 0, isFeatured: input.isFeatured ?? false, createdByUserId: actorId(ctx) || null, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        const updated = await tx.categorySuggestion.update({ where: { id }, data: { status: 'APPROVED', approvedCategoryId: category.id, reviewedByUserId: actorId(ctx) || null, reviewedAt: new Date() } });
        await audit(tx, ctx, 'categorySuggestions', 'CATEGORY_SUGGESTION_RESOLUTION_CHANGED', 'CategorySuggestion', id, {
            suggestionId: id,
            oldStatus: suggestion.status,
            oldApprovedCategoryId: suggestion.approvedCategoryId,
            newStatus: updated.status,
            newApprovedCategoryId: category.id,
            newParentCategoryId: parentId,
            actor: actorId(ctx) || null,
            timestamp: new Date().toISOString(),
            resolution: 'CREATED_CATEGORY',
        });
        return updated;
    });
}
export async function listCategorySuggestions(ctx, filters, organizationId) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 30));
    const where = { deletedAt: null, ...(organizationId ? { organizationId } : {}) };
    if (filters.status)
        where.status = filters.status;
    if (filters.parentCategoryId)
        where.parentCategoryId = filters.parentCategoryId;
    if (filters.search?.trim())
        where.proposedName = { contains: filters.search.trim(), mode: 'insensitive' };
    if (filters.from || filters.to)
        where.createdAt = { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) };
    const [items, total] = await Promise.all([ctx.prisma.categorySuggestion.findMany({ where, include: { organization: { select: { name: true } }, parentCategory: true, approvedCategory: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), ctx.prisma.categorySuggestion.count({ where })]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
