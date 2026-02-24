import { extendType, arg, nonNull, objectType } from "nexus";
import * as userService from "../../../services/user.service.js";
import { requireAuth, requireRole, } from "../../../middleware/auth.middleware.js";
export const UserStaff = objectType({
    name: "UserStaff",
    definition(t) {
        t.nonNull.field("user", {
            type: "User"
        });
        t.nonNull.int("id");
        t.nonNull.int("outletId");
        t.nonNull.boolean("isPresent");
    }
});
export const outletsWithStaffs = objectType({
    name: "OutletsWithStaff",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nonNull.list.nonNull.field("staff", { type: "User" });
    },
});
export const userQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("getAllUsers", {
            type: "User",
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                try {
                    return await userService.getAllUsers();
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all user data:", error);
                    throw new Error("Error getting all user data:", error.message);
                }
            },
        });
        t.nonNull.list.nonNull.field("getAllStaffs", {
            type: "User",
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER"]);
                const managerId = ctx.user.userId;
                try {
                    return await userService.getAllStaffs(Number(managerId));
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all staff data:", error);
                    throw new Error("Error getting all staff data:", error.message);
                }
            },
        });
        t.nonNull.field("getUserById", {
            type: "User",
            args: {
                id: nonNull(arg({ type: "ID" })),
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                try {
                    const userId = parseInt(id);
                    return await userService.getUserById(userId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all user data:", error);
                    throw new Error("Error getting all user data:", error.message);
                }
            },
        });
        t.nonNull.list.nonNull.field("getAllOutletStaffs", {
            type: "OutletsWithStaff",
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", ""]);
                const userId = ctx.user.userId;
                try {
                    return await userService.getAllOutletStaffs(Number(userId));
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all your staffs:", error);
                    throw new Error("Error getting all your staffs");
                }
            },
        });
        t.nonNull.field("ME", {
            type: "User",
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const userId = Number(ctx.user.userId);
                try {
                    return await userService.getUserById(userId);
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.log("Error getting current user:", error);
                    throw new Error("Error getting current user");
                }
            }
        });
        t.nonNull.list.nonNull.field("getStaffByOutletId", {
            type: "UserStaff",
            args: {
                outletId: nonNull(arg({ type: "ID" }))
            },
            async resolve(_, { outletId }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                try {
                    return await userService.getStaffByOutletId(Number(outletId));
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error getting all your staffs by outlet Id:", error);
                    throw new Error("Error getting all your staffs");
                }
            }
        });
    },
});
