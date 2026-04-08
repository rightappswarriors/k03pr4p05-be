import { extendType, arg, nonNull, nullable, stringArg, objectType, intArg } from "nexus";
import { requireRole, requireAuth } from "../../../middleware/auth.middleware.js";
import { createUser, loginUser, updateUser, deleteUser, createStaff, } from "../../../services/user.service.js";
export const AuthPayload = objectType({
    name: "AuthPayload",
    definition(t) {
        t.nonNull.field("user", { type: "User" });
        t.nonNull.string("token");
        t.nonNull.string("refresh_token");
    },
});
import { prisma } from "../../../lib/prisma.js";
export const userMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("signup", {
            type: "User",
            args: {
                fullname: nonNull(stringArg()),
                password: nonNull(stringArg()),
                email: nonNull(stringArg()),
                contactNumber: nonNull(stringArg()),
                username: nonNull(arg({ type: "String" })),
                role: arg({ type: "Role" }),
            },
            async resolve(_, { fullname, username, email, password, role }, ctx) {
                console.log("Try Login");
                // Validate that required fields are not empty strings
                if (!fullname || !username || !email || !password) {
                    throw new Error("Full name, username, email, and password cannot be empty.");
                }
                const userExists = await ctx.prisma.user.findFirst({
                    where: {
                        OR: [{ username: username }, { email: email }],
                    },
                });
                if (userExists) {
                    if (userExists.username === username) {
                        throw new Error(`User with username: ${username} already exists`);
                    }
                    else {
                        throw new Error(`User with email: ${email} already exists`);
                    }
                }
                const newUser = await createUser({
                    fullname,
                    username,
                    email,
                    password,
                    role,
                });
                return newUser;
            },
        });
        // Register user with OTP email flow
        t.nonNull.field('registerUser', {
            type: 'User',
            args: {
                fullname: nonNull(stringArg()),
                email: nonNull(stringArg()),
                password: nonNull(stringArg()),
                contactNumber: stringArg(),
            },
            async resolve(_, { fullname, email, password, contactNumber }) {
                const { registerUser } = await import('../../../services/authService.js');
                return registerUser({ fullname, email, password, contactNumber });
            },
        });
        t.nonNull.field('registerAdmin', {
            type: 'User',
            args: {
                fullname: nonNull(stringArg()),
                email: nonNull(stringArg()),
                role: nullable(stringArg()),
                password: nonNull(stringArg()),
                contactNumber: stringArg(),
            },
            async resolve(_, { fullname, role = "ADMIN", email, password, contactNumber }) {
                const { registerUser } = await import('../../../services/authService.js');
                return registerUser({ fullname, email, role, password, contactNumber });
            },
        });
        t.nonNull.field('verifyEmail', {
            type: 'AuthPayload',
            args: {
                email: nonNull(stringArg()),
                code: nonNull(stringArg()),
            },
            async resolve(_, { email, code }, { res }) {
                const { verifyEmail } = await import('../../../services/authService.js');
                return verifyEmail({ email, code, res });
            },
        });
        t.nonNull.field('resendOTP', {
            type: 'String',
            args: {
                email: nonNull(stringArg()),
            },
            async resolve(_, { email }) {
                const { resendOTP } = await import('../../../services/authService.js');
                const result = await resendOTP({ email });
                return result.message;
            },
        });
        t.nonNull.field("createStaff", {
            type: "User",
            args: {
                fullname: nonNull(arg({ type: "String" })),
                password: nonNull(arg({ type: "String" })),
                email: nonNull(arg({ type: "String" })),
                username: nonNull(arg({ type: "String" })),
                role: nullable(arg({ type: "Role" })),
                departmentId: nullable(intArg()),
                positionId: nullable(arg({ type: "String" })),
            },
            async resolve(_, { fullname, username, email, password, role, departmentId, positionId }, ctx) {
                // Validate that required fields are not empty strings
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN"]);
                if (!role) {
                    role = "STAFF";
                }
                if (process.env.NODE_ENV === "development")
                    console.log(role);
                if (!fullname || !username || !email || !password) {
                    throw new Error("Full name, username, email, and password cannot be empty.");
                }
                const userExists = await ctx.prisma.user.findFirst({
                    where: {
                        OR: [{ username: username }, { email: email }],
                    },
                });
                if (userExists) {
                    if (userExists.username === username) {
                        throw new Error(`User with username: ${username} already exists`);
                    }
                    else {
                        throw new Error(`User with email: ${email} already exists`);
                    }
                }
                try {
                    const managerId = ctx.user.userId;
                    const newStaff = await createStaff({
                        fullname,
                        username,
                        email,
                        password,
                        role,
                        managerId,
                        departmentId,
                        positionId,
                    });
                    return newStaff;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.log("Error creating Staff:", error);
                    throw new Error("Error Creating staff", error);
                }
            },
        });
        t.nonNull.field("createHRUser", {
            type: "User",
            args: {
                fullname: nonNull(arg({ type: "String" })),
                email: nonNull(arg({ type: "String" })),
                password: nonNull(arg({ type: "String" })),
                role: nullable(arg({ type: "Role" })),
                departmentId: nullable(intArg()),
                positionId: nullable(arg({ type: "String" })),
            },
            async resolve(_, { fullname, email, password, role, departmentId, positionId }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
                if (!fullname || !email || !password) {
                    throw new Error("Full name, email, and password cannot be empty.");
                }
                if (!role) {
                    role = "STAFF";
                }
                const usernameBase = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || fullname.split(" ")[0].toLowerCase();
                let username = usernameBase;
                let counter = 1;
                while (await ctx.prisma.user.findUnique({ where: { username } })) {
                    username = `${usernameBase}${counter++}`;
                }
                try {
                    const managerId = ctx.user.userId;
                    const newStaff = await createStaff({
                        fullname,
                        username,
                        email,
                        password,
                        role,
                        managerId,
                        departmentId,
                        positionId,
                    });
                    return newStaff;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.log("Error creating HR user:", error);
                    throw new Error("Error creating HR user: " + (error?.message || error));
                }
            },
        });
        t.nonNull.field("updateUser", {
            type: "User",
            args: {
                id: nonNull(arg({ type: "ID" })),
                fullname: nullable(arg({ type: "String" })),
                username: nullable(arg({ type: "String" })),
                positionId: nullable(arg({ type: "String" })),
            },
            async resolve(_, { id, fullname, username, positionId }, ctx) {
                if (!ctx.user) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Authentication required");
                    throw new Error("Authentication required");
                }
                const userId = parseInt(id);
                if (!fullname && !username && typeof positionId === 'undefined') {
                    throw new Error("At least one field (fullname, username, or positionId) must be provided.");
                }
                if (username) {
                    const userExists = await ctx.prisma.user.findUnique({
                        where: { username: username },
                    });
                    if (userExists && userExists.id !== userId) {
                        throw new Error(`User with username: ${username} already exists`);
                    }
                }
                const updatedUser = await updateUser(userId, { fullname, username, positionId });
                return updatedUser;
            },
        });
        t.nonNull.field("deleteUser", {
            type: "User",
            args: {
                id: nonNull(arg({ type: "ID" })),
            },
            async resolve(_, { id }, ctx) {
                if (!ctx.user) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Authentication required");
                    throw new Error("Authentication required");
                }
                const userId = parseInt(id);
                try {
                    const deletedUser = await deleteUser(userId);
                    return deletedUser;
                }
                catch (error) {
                    throw new Error(`Failed to delete user: ${error.message}`);
                }
            },
        });
        //! LOGIN
        t.nonNull.field("login", {
            type: "AuthPayload",
            args: {
                email: nonNull(stringArg()),
                password: nonNull(stringArg()),
            },
            async resolve(_, { email, password }, { res }) {
                if (!email || !password) {
                    throw new Error("Email and Password is Required");
                }
                try {
                    const user = await loginUser(email, password, res);
                    if (!user) {
                        throw new Error("Invalid email or password");
                    }
                    return user;
                }
                catch (error) {
                    if (process.env.NODE_ENV === "development")
                        console.error("Error upon Sign in:", error);
                    console.error('Real login error:', error); // ← add this
                    throw new Error("Error upon Sign in:", error);
                }
            },
        });
        t.nonNull.field("StaffLogout", {
            type: "Boolean",
            args: {
                outletId: nonNull(arg({ type: "ID" }))
            },
            async resolve(_, { outletId }, ctx) {
                requireAuth(ctx);
                const outletID = Number(outletId);
                const userId = Number(ctx.user.userId);
                if (process.env.NODE_ENV === "development")
                    console.log("Logging out user with ID:", userId);
                const exists = await prisma.outletStaff.findFirst({
                    where: { userId, outletId: outletID }
                });
                if (exists) {
                    if (process.env.NODE_ENV === "development")
                        console.log("User is Staff setIsPresent to false:", userId);
                    const data = await prisma.outletStaff.update({
                        where: {
                            outletId_userId: {
                                outletId: outletID,
                                userId,
                            }
                        },
                        data: { isPresent: false },
                    });
                    console.log(data);
                }
                return true;
            },
        });
    },
});
