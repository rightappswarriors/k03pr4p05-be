export function requireAuth(ctx) {
  if (!ctx.user) {
    console.error("Authentication required");
    throw new Error("Authentication required");
  }
}
export function requireOwnership(modelName: string, paramId: string) {
  return (resolver) => {
    return async (parent, args, ctx, info) => {
      const userId = ctx.user?.userId;
      const resourceId = args[paramId];

      if (!userId || !resourceId) {
        throw new Error(
          "Invalid request parameters or missing user information."
        );
      }

      const resource = await ctx.prisma[modelName].findUnique({
        where: { id: Number(resourceId) },
        select: { ownerId: true },
      });

      if (!resource) {
        throw new Error(`${modelName} not found`);
      }

      if (resource.ownerId !== userId) {
        throw new Error("You do not have permission to access this resource");
      }

      return resolver(parent, args, ctx, info);
    };
  };
}

export function requireRole(requiredRoles) {
  return (resolver) => {
    return (parent, args, ctx, info) => {
      const userRole = ctx.user?.role;
      const rolesArray = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      if (!userRole || !rolesArray.includes(userRole)) {
        throw new Error("You do not have the necessary permissions.");
      }

      return resolver(parent, args, ctx, info);
    };
  };
}
