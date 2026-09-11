export function hasPrivilegedPageAccess(ctx) {
    return Boolean(ctx.user?.isOwner ||
        ctx.user?.role === "OWNER" ||
        ctx.user?.role === "MANAGER" ||
        ctx.user?.role === "ADMIN");
}
export function requireAuth(ctx) {
    if (!ctx.user) {
        if (process.env.NODE_ENV === "development")
            console.error("Authentication required");
        throw new Error("Authentication required");
    }
    // This is intentionally centralized so authenticated business resolvers
    // that only call requireAuth cannot bypass an organization enforcement.
    // Platform administrators remain able to review governed accounts.
    if (ctx.user.role !== 'ADMIN' && ctx.user.orgAccountStatus === 'BANNED') {
        throw new Error('Organization account is banned.');
    }
    if (ctx.user.role !== 'ADMIN' && ctx.user.orgAccountStatus === 'SUSPENDED') {
        throw new Error('Organization account is suspended.');
    }
}
// middleware/auth.middleware.ts
export function requirePagePermission(ctx, pageKey, action) {
    requireAuth(ctx);
    if (ctx.user?.role !== 'ADMIN' && ctx.user?.orgAccountStatus === 'BANNED') {
        throw new Error('Organization account is banned.');
    }
    if (ctx.user?.role !== 'ADMIN' && ctx.user?.orgAccountStatus === 'SUSPENDED') {
        throw new Error('Organization account is suspended.');
    }
    if (hasPrivilegedPageAccess(ctx))
        return;
    const perm = ctx.userPermissions[pageKey]; // ← just a map lookup, no DB
    if (!perm?.[action]) {
        throw new Error("You do not have permission to perform this action.");
    }
    ctx.permission = perm; // attach for resolver use
}
// middleware/auth.middleware.ts
export function requireAnyPagePermission(ctx, pages) {
    requireAuth(ctx);
    if (hasPrivilegedPageAccess(ctx))
        return;
    const hasAny = pages.some(({ pageKey, action }) => {
        return ctx.userPermissions[pageKey]?.[action] === true;
    });
    if (!hasAny) {
        throw new Error("You do not have permission to perform this action.");
    }
}
// middleware/auth.middleware.ts
export function requireControlPermission(ctx, controlKey) {
    requireAuth(ctx);
    if (ctx.user?.role !== 'ADMIN' && ctx.user?.orgAccountStatus !== null && ctx.user?.orgAccountStatus !== undefined && ctx.user.orgAccountStatus !== 'ACTIVE') {
        throw new Error(`Organization account is ${ctx.user.orgAccountStatus.toLowerCase()}.`);
    }
    if (hasPrivilegedPageAccess(ctx))
        return;
    const isAllowed = ctx.controlPermissions?.[controlKey];
    if (!isAllowed) {
        throw new Error("You do not have permission to perform this action.");
    }
}
export async function requireOwnership(ctx, modelName, resourceId) {
    const userId = ctx.user?.userId;
    if (!userId || !resourceId) {
        throw new Error("Invalid request parameters or missing user information.");
    }
    const delegate = ctx.prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
    if (!delegate) {
        throw new Error(`Model ${modelName} not found in Prisma client`);
    }
    const resource = await delegate.findUnique({
        where: { id: Number(resourceId) },
        select: { ownerId: true },
    });
    if (!resource) {
        throw new Error(`${modelName} not found`);
    }
    if (resource.ownerId !== userId) {
        throw new Error("You do not have permission to access this resource");
    }
}
export function requireRole(ctx, requiredRoles) {
    const userRole = ctx.user?.role;
    const rolesArray = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];
    if (!userRole || !rolesArray.includes(userRole)) {
        if (process.env.NODE_ENV === "development")
            console.error("Permission denied for role:", userRole);
        throw new Error("You do not have the necessary permissions.");
    }
}
// Check if SUPPLIER role has been approved
export function requireApprovedSupplier(ctx) {
    requireAuth(ctx);
    if (ctx.user?.role !== 'SUPPLIER') {
        return; // Not a supplier, no check needed
    }
    if (ctx.user?.approvalStatus !== 'APPROVED') {
        throw new Error("Your supplier account is pending approval. Please wait for admin review.");
    }
}
// Require that user is either not a supplier, or is an approved supplier
export function requireSupplierOrApproved(ctx) {
    requireAuth(ctx);
    if (ctx.user?.role === 'SUPPLIER' && ctx.user?.approvalStatus !== 'APPROVED') {
        throw new Error("Access denied: supplier account pending approval");
    }
}
