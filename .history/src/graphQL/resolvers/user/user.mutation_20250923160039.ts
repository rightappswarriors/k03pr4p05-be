import { extendType, arg, nonNull } from "nexus";
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
        const userExists = await ctx.prisma.user.findUnique({
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
  },
});
