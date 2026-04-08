import { requireAuth } from "../../../middleware/auth.middleware.js";

export async function resolvePermission(userId: number, pageKey: string, ctx: any) {
  requireAuth(ctx)

  // Get user's position
  const user = await ctx.prisma.user.findUnique({
    where: { id: userId },
    include: { position: { include: { permissions: { include: { page: true } } } } }
  })

  if (!user) throw new Error('User not found')

  // Check user override first
  const override = await ctx.prisma.userPermissionOverride.findUnique({
    where: { userId_pageId: { userId, pageId: pageKey } }
  })

  if (override) {
    return {
      canView: override.canView ?? false,
      canCreate: override.canCreate ?? false,
      canEdit: override.canEdit ?? false,
      canDelete: override.canDelete ?? false,
    }
  }

  // Fallback to position permissions
  const positionPermission = user.position?.permissions.find((p: any) => p.page.key === pageKey)

  return {
    canView: positionPermission?.canView ?? false,
    canCreate: positionPermission?.canCreate ?? false,
    canEdit: positionPermission?.canEdit ?? false,
    canDelete: positionPermission?.canDelete ?? false,
  }
}