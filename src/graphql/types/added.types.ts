import { enumType, objectType, inputObjectType } from 'nexus'

export const AuditActionEnum = enumType({
  name: 'AuditAction',
  members: ['CREATE', 'EDIT', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE']
})

export const PageType = objectType({
  name: 'Page',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('key')
    t.nonNull.string('label')
    t.nullable.string('parentKey')
    t.nonNull.int('sortOrder')
  }
})

export const PositionPermissionType = objectType({
  name: 'PositionPermission',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('positionId')
    t.nonNull.string('pageId')
    t.nonNull.boolean('canView')
    t.nonNull.boolean('canCreate')
    t.nonNull.boolean('canEdit')
    t.nonNull.boolean('canDelete')
    t.field('position', {
      type: 'Position',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.position.findUnique({
          where: { id: parent.positionId }
        })
      }
    })
    t.field('page', {
      type: 'Page',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.page.findUnique({
          where: { id: parent.pageId }
        })
      }
    })
  }
})

export const UserPermissionOverrideType = objectType({
  name: 'UserPermissionOverride',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.int('userId')
    t.nonNull.string('pageId')
    t.nullable.boolean('canView')
    t.nullable.boolean('canCreate')
    t.nullable.boolean('canEdit')
    t.nullable.boolean('canDelete')
    t.field('user', {
      type: 'User',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.user.findUnique({
          where: { id: parent.userId }
        })
      }
    })
    t.field('page', {
      type: 'Page',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.page.findUnique({
          where: { id: parent.pageId }
        })
      }
    })
  }
})

export const PositionControlPermissionType = objectType({
  name: 'PositionControlPermission',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.string('positionId')
    t.nonNull.string('controlKey')
    t.nonNull.boolean('isAllowed')
    t.field('position', {
      type: 'Position',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.position.findUnique({
          where: { id: parent.positionId }
        })
      }
    })
  }
})

export const AuditLogType = objectType({
  name: 'AuditLogType',
  definition(t) {
    t.nonNull.string('id')
    t.nonNull.int('orgId')
    t.nonNull.int('userId')
    t.nonNull.string('pageKey')
    t.nonNull.field('action', { type: 'AuditAction' })
    t.nullable.string('recordId')
    t.nullable.string('recordType')
    t.nullable.json('oldValue')
    t.nullable.json('newValue')
    t.nullable.string('ipAddress')
    t.nullable.string('userAgent')
    t.nonNull.dateTime('createdAt')
    t.field('user', {
      type: 'User',
      resolve: (parent, _, ctx) => {
        return ctx.prisma.user.findUnique({
          where: { id: parent.userId }
        })
      }
    })
  }
})

export const PermissionInput = inputObjectType({
  name: 'PermissionInput',
  definition(t) {
    t.nonNull.string('pageId')
    t.nonNull.boolean('canView')
    t.nonNull.boolean('canCreate')
    t.nonNull.boolean('canEdit')
    t.nonNull.boolean('canDelete')
  }
})

export const PositionInput = inputObjectType({
  name: 'PositionInput',
  definition(t) {
    t.nonNull.string('name')
    t.nullable.string('description')
  }
})

export const AuditLogFiltersInput = inputObjectType({
  name: 'AuditLogFiltersInput',
  definition(t) {
    t.nullable.int('userId')
    t.nullable.field('action', { type: 'AuditAction' })
    t.nullable.string('pageKey')
    t.nullable.dateTime('dateFrom')
    t.nullable.dateTime('dateTo')
  }
})

export const PaginationInput = inputObjectType({
  name: 'PaginationInput',
  definition(t) {
    t.nullable.int('page')
    t.nullable.int('pageSize')
  }
})