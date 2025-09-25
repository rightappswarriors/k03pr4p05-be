import { extendType, arg, nonNull,nullable } from "nexus";
import { createUser } from "../../../services/user.service.js";

export const userMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("signup", {
      type: "User",
      args: {
        fullname: nonNull(arg({ type: "String" })),
        password: nonNull(arg({ type: "String" })),
        email: nonNull(arg({ type: "String" })),
        username: nonNull(arg({ type: "String" })),
        role: arg({ type: "Role" }),
      },
      async resolve(
        parent,
        { fullname, username, email, password, role },
        ctx
      ) {
        // Validate that required fields are not empty strings
        if (!fullname || !username || !email || !password) {
          throw new Error(
            "Full name, username, email, and password cannot be empty."
          );
        }
        const userExists = await ctx.prisma.user.findFirst({
          where: {
            OR: [{ username: username }, { email: email }],
          },
        });
        if (userExists) {
          if (userExists.username === username) {
            throw new Error(`User with username: ${username} already exists`);
          } else {
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
    t.nonNull.field("updateUser", {
     type: "User",
     args: {
          id : nonNull(arg({ type: "Int"})),
          fullname: nullable(arg({ type: "String"})),
          username: nullable(arg({ type: "String"}))
     },
     async resolve(parent, {id, fullname, username}, ctx) {
          if (!fullname && !username) {
               throw new Error(
                    "Both fields are empty"
               )
          }
          const userExists = await ctx.prisma.user.findFirst({
               where: {
                    OR: [{ username: username}, { username: username}]
               }
          })
          if (userExists) {
               if (userExists.username === username) {
                    throw new Error(`User with this Username: ${username} already exists`);
                  } else {
                    throw new Error(`User with this Full name: ${fullname} already exists`);
                  }
          }

     }
    })
  },
});
