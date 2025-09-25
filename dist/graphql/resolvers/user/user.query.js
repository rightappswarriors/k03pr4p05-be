import { extendType, arg, nonNull } from "nexus";
import * as userService from '../../../services/user.service.js';
export const userQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("getAllUsers", {
            type: "User",
            resolve: async (parent, args, ctx) => {
                return await userService.getAllUsers();
            },
        });
        t.field("getUserById", {
            type: "User",
            args: {
                id: nonNull(arg({ type: "Int" })),
            },
            resolve: async (parent, { id }, ctx) => {
                return await userService.getUserById(id);
            },
        });
    },
});
