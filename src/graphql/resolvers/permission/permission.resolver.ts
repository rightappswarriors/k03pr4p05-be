// src/graphql/resolvers/permission/permission.resolver.ts
import { hasPrivilegedPageAccess, requireAuth } from "../../../middleware/auth.middleware.js";

export async function resolvePermission(userId: number, pageKey: string, ctx: any) {
  requireAuth(ctx)

  if (userId === ctx.user.id) {
    return ctx.userPermissions[pageKey] ?? {
      canView: hasPrivilegedPageAccess(ctx),
      canCreate: hasPrivilegedPageAccess(ctx),
      canEdit: hasPrivilegedPageAccess(ctx),
      canDelete: hasPrivilegedPageAccess(ctx),
    }
  }

  // Get user's position
  const user = await ctx.prisma.user.findUnique({
    where: { id: userId },
    include: {
      position: { include: { permissions: { include: { page: true } } } },
      permissionOverrides: { include: { page: true } },
    }
  })

  if (!user) throw new Error('User not found')
  if (!hasPrivilegedPageAccess(ctx) || user.orgId !== ctx.user.orgId) {
    throw new Error('You do not have permission to perform this action.')
  }
  if (user.position?.orgId !== user.orgId) {
    return { canView: false, canCreate: false, canEdit: false, canDelete: false }
  }

  const positionPermission = user.position?.permissions.find((p: any) => p.page.key === pageKey)
  const override = user.permissionOverrides.find((o: any) => o.page.key === pageKey)

  return {
    canView: override?.canView ?? positionPermission?.canView ?? false,
    canCreate: override?.canCreate ?? positionPermission?.canCreate ?? false,
    canEdit: override?.canEdit ?? positionPermission?.canEdit ?? false,
    canDelete: override?.canDelete ?? positionPermission?.canDelete ?? false,
  }
}
