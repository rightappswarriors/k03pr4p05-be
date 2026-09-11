export function resolvePermissionState(input) {
    const userPermissions = {};
    const controlPermissions = {};
    if (input.userOrgId == null || input.positionOrgId !== input.userOrgId) {
        return { userPermissions, controlPermissions };
    }
    for (const permission of input.positionPermissions ?? []) {
        userPermissions[permission.page.key] = {
            canView: permission.canView,
            canCreate: permission.canCreate,
            canEdit: permission.canEdit,
            canDelete: permission.canDelete,
        };
    }
    for (const override of input.overrides ?? []) {
        const base = userPermissions[override.page.key];
        userPermissions[override.page.key] = {
            canView: override.canView ?? base?.canView ?? false,
            canCreate: override.canCreate ?? base?.canCreate ?? false,
            canEdit: override.canEdit ?? base?.canEdit ?? false,
            canDelete: override.canDelete ?? base?.canDelete ?? false,
        };
    }
    for (const permission of input.controlPermissions ?? []) {
        controlPermissions[permission.controlKey] = permission.isAllowed;
    }
    return { userPermissions, controlPermissions };
}
