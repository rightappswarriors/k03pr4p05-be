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

export const TokenPayload = objectType({
  name: "TokenPayload",
  definition(t) {
    t.nonNull.string("token");
    t.nonNull.string("refresh_token");
  },
});
export const RefreshMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("refreshToken", {
      type: "AuthPayload",
      async resolve(_, __, ctx) {
        const refresh_token = ctx.req.cookies?.refresh_token;
        if (!refresh_token) {
          throw new Error("No refresh token provided");
        }
        try {
          const payload = jwt.verify(refresh_token, REFRESH_SECRET)

          const user = await ctx.prisma.findUnique({
               where: {
                    id: payload.userId
               }
          })
          if (!user) throw new Error("User not found")
          const newAccessToken = jwt.sign(
               { userId: user.id, role: user.role},
               JWT_SECRET,
               { expiresIn: "15m"}
          )
          const newRefreshToken = jwt.sign(
               { userId: user.id},
               REFRESH_SECRET,
               { expiresIn: "7d"}
          )
        } catch (error) {
          console.error("Error refreshing token", error);
          throw new Error("Error refreshing token.");
        }
      },
    });
  },
});
