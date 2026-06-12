import { arg, extendType, nonNull, nullable, stringArg, intArg, list } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";

export const positionMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createPosition", {
      type: "Position",
      args: {
        input: nonNull(arg({ type: "PositionInput" })),
      },
      resolve: async (parent, { input }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const orgId = Number(ctx.user.orgId)
        try{
        const position = await ctx.prisma.position.create({
          data: {
            orgId,
            name: input.name,
            description: input.description,
          }
        })
        // Log to AuditLog
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId: ctx.user.id,
            pageKey: 'positions',
            action: 'CREATE',
            recordId: position.id,
            recordType: 'Position',
            newValue: { name: input.name, description: input.description },
          }
        })
        return position} catch(error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error creating position:", error);
          }
          throw new Error("Failed to create position. Please try again.");
        }
      }
    })
    t.nonNull.field("updatePosition", {
      type: "Position",
      args: {
        id: nonNull(stringArg()),
        input: nonNull(arg({ type: "PositionInput" })),
      },
      resolve: async (parent, { id, input }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const orgId = Number(ctx.user.orgId)
        
        const oldPosition = await ctx.prisma.position.findUnique({ where: { id } })
        
        // Verify the position belongs to the user's organization
        if (!oldPosition || oldPosition.orgId !== orgId) {
          throw new Error("Position not found or access denied")
        }
        
        const position = await ctx.prisma.position.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            permissionsVersion: new Date(),
          }
        })
        // Log PERMISSION_CHANGE
        await ctx.prisma.auditLog.create({
          data: {
            orgId: Number(ctx.user.orgId),
            userId: ctx.user.id,
            pageKey: 'positions',
            action: 'PERMISSION_CHANGE',
            recordId: id,
            recordType: 'Position',
            oldValue: { name: oldPosition?.name, description: oldPosition?.description },
            newValue: { name: input.name, description: input.description },
          }
        })
        return position
      }
    })
    t.nonNull.field("deletePosition", {
      type: "Position",
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (parent, { id }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const orgId = Number(ctx.user.orgId)
        console.log("Attempting to delete position with ID:", id, "by user:", ctx.user.username);
        try {
          const position = await ctx.prisma.position.findUnique({ where: { id } })
          
          // Verify the position belongs to the user's organization
          if (!position) {
            throw new Error("Position not found")
          }
          
          if (position.orgId !== orgId) {
            throw new Error("Position belongs to a different organization")
          }
          
          await ctx.prisma.position.update({
            where: { id },
            data: { deletedAt: new Date() },
          })
          // Log to AuditLog
          await ctx.prisma.auditLog.create({
            data: {
              orgId,
              userId: ctx.user.id,
              pageKey: 'positions',
              action: 'DELETE',
              recordId: id,
              recordType: 'Position',
              oldValue: { name: position?.name, description: position?.description },
            }
          })
          return position
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error deleting position:", error);
          }
          throw error;
        }
      }
    })
    t.nonNull.list.nonNull.field("setPositionPermissions", {
      type: "PositionPermission",
      args: {
        positionId: nonNull(stringArg()),
        permissions: nonNull(list(nonNull(arg({ type: "PermissionInput" })))),
      },
      resolve: async (parent, { positionId, permissions }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const orgId = Number(ctx.user.orgId)
        
        // Verify the position exists and belongs to this organization
        const position = await ctx.prisma.position.findUnique({ where: { id: positionId } })
        if (!position || position.orgId !== orgId) {
          throw new Error("Position not found or access denied")
        }
        
        // Delete existing
        await ctx.prisma.positionPermission.deleteMany({ where: { positionId } })
        // Create new
        const created = await ctx.prisma.$transaction(
          permissions.map((p: any) =>
            ctx.prisma.positionPermission.create({
              data: {
                positionId,
                pageId: p.pageId,
                canView: p.canView,
                canCreate: p.canCreate,
                canEdit: p.canEdit,
                canDelete: p.canDelete,
              }
            })
          )
        )
        // Update permissionsVersion
        await ctx.prisma.position.update({
          where: { id: positionId },
          data: { permissionsVersion: new Date() }
        })
        // Log PERMISSION_CHANGE
        await ctx.prisma.auditLog.create({
          data: {
            orgId: Number(ctx.user.orgId),
            userId: ctx.user.id,
            pageKey: 'positions',
            action: 'PERMISSION_CHANGE',
            recordId: positionId,
            recordType: 'PositionPermission',
            newValue: permissions,
          }
        })
        return created
      }
    })
    t.nonNull.field("setUserPermissionOverride", {
      type: "UserPermissionOverride",
      args: {
        userId: nonNull(intArg()),
        pageId: nonNull(stringArg()),
        canView: nullable(arg({ type: "Boolean" })),
        canCreate: nullable(arg({ type: "Boolean" })),
        canEdit: nullable(arg({ type: "Boolean" })),
        canDelete: nullable(arg({ type: "Boolean" })),
      },
      resolve: async (parent, { userId, pageId, canView, canCreate, canEdit, canDelete }, ctx) => {
        requireAuth(ctx)
        requireRole(ctx, ["OWNER"])
        const override = await ctx.prisma.userPermissionOverride.upsert({
          where: { userId_pageId: { userId, pageId } },
          update: { canView, canCreate, canEdit, canDelete },
          create: { userId, pageId, canView, canCreate, canEdit, canDelete },
        })
        // Log PERMISSION_CHANGE
        await ctx.prisma.auditLog.create({
          data: {
            orgId: Number(ctx.user.orgId),
            userId: ctx.user.id,
            pageKey: 'user_permissions',
            action: 'PERMISSION_CHANGE',
            recordId: String(userId),
            recordType: 'UserPermissionOverride',
            newValue: { pageId, canView, canCreate, canEdit, canDelete },
          }
        })
        return override
      }
    })
  }
})
