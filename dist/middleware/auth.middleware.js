export function requireAuth(ctx) {
    if (!ctx.user) {
        console.error("Authentication required");
        throw new Error("Authentication required");
    }
}
export async function requirePermission(ctx, pageKey, action) {
    requireAuth(ctx);
    // If owner, allow everything
    if (ctx.user.isOwner)
        return;
    // Import here to avoid circular dependency
    const { resolvePermission } = await import('../graphql/resolvers/permission/permission.resolver.js');
    const permission = await resolvePermission(ctx.user.id, pageKey, ctx);
    if (action) {
        const actionMap = {
            view: 'canView',
            create: 'canCreate',
            edit: 'canEdit',
            delete: 'canDelete'
        };
        if (!permission[actionMap[action]]) {
            throw new Error(`Forbidden: No ${action} permission for ${pageKey}`);
        }
    }
    else {
        // Default check canView
        if (!permission.canView) {
            throw new Error(`Forbidden: No view permission for ${pageKey}`);
        }
    }
    // Attach permission to context for resolvers to use
    ctx.permission = permission;
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
        console.error("Permission denied for role:", userRole);
        throw new Error("You do not have the necessary permissions.");
    }
}
