import jwt from "jsonwebtoken";
import { extendType, objectType } from "nexus";
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

export const AuthPayload = objectType({
  name: "AuthPayload",
  definition(t) {
    t.nonNull.field("user", { type: "User" });
    t.nonNull.string("token");
    t.nonNull.string("refresh_token");
  },
});

export const RefreshMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("refreshToken", {
      type: "String",
      async resolve(_, __, ctx) {
        const refresh_token = ctx.req.cookies?.refresh_token;
        if (!refresh_token) {
          throw new Error("No refresh token provided");
        }
        try {
          const payload = jwt.verify(refresh_token, REFRESH_SECRET);

          const user = await ctx.prisma.user.findUnique({
            where: {
              id: payload.userId,
            },
          });
          if (!user) throw new Error("User not found");

          return jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || "token",
            {
              expiresIn: "15m",
            }
          );
        } catch (error) {
          console.error("Error refreshing token", error);
          throw new Error("Error refreshing token.");
        }
      },
    });
  },
});
