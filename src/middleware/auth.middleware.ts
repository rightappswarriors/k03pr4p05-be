import { Context, PagePermission } from "../lib/types.js";

export function requireAuth(ctx: Context) {
  if (!ctx.user) {
    console.error("Authentication required");
    throw new Error("Authentication required");
  }
}

// middleware/auth.middleware.ts
export function requirePagePermission(
  ctx: Context,
  pageKey: string,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete'
) {
  requireAuth(ctx);

  if (ctx.user?.isOwner || ctx.user?.role === "MANAGER" || ctx.user?.role === "OWNER") return; // bypass

  const perm = ctx.userPermissions[pageKey]; // ← just a map lookup, no DB

  if (!perm?.[action]) {
    throw new Error(`Access denied: insufficient permission for ${pageKey}.${action}`);
  }

  ctx.permission = perm; // attach for resolver use
}

// middleware/auth.middleware.ts
export function requireAnyPagePermission(
  ctx: Context,
  pages: { pageKey: string; action: keyof PagePermission }[]
) {
  requireAuth(ctx);
  if (ctx.user?.isOwner) return;

  const hasAny = pages.some(({ pageKey, action }) => {
    return ctx.userPermissions[pageKey]?.[action] === true;
  });

  if (!hasAny) {
    const labels = pages.map(p => `${p.pageKey}.${p.action}`).join(' or ');
    throw new Error(`Access denied: requires ${labels}`);
  }
}
// middleware/auth.middleware.ts
export function requireControlPermission(ctx: Context, controlKey: string) {
  requireAuth(ctx);
  if (ctx.user?.isOwner || ctx.user?.role === "MANAGER" || ctx.user?.role === "OWNER") return;

  const isAllowed = ctx.controlPermissions?.[controlKey];
  if (!isAllowed) {
    throw new Error(`Access denied: insufficient control permission for '${controlKey}'`);
  }
}
export async function requireOwnership(ctx: any, modelName: string, resourceId: number | string) {

  const userId = ctx.user?.userId;

  if (!userId || !resourceId) {
    throw new Error("Invalid request parameters or missing user information.");
  }
  const delegate = ctx.prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)]
  if (!delegate) {
    throw new Error(`Model ${modelName} not found in Prisma client`)
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


export function requireRole(ctx: Context, requiredRoles: any) {
  const userRole = ctx.user?.role;

  const rolesArray = Array.isArray(requiredRoles)
    ? requiredRoles
    : [requiredRoles];

  if (!userRole || !rolesArray.includes(userRole)) {
    console.error("Permission denied for role:", userRole);
    throw new Error("You do not have the necessary permissions.");
  }
}