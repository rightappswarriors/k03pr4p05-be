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
      async resolve(_, __, {req, res, prisma}) {
        const token = req.cookies.jid
        if (!token) {
          throw new Error("No refresh token provided");
        }
        let payload = null
        try {
          payload = jwt.verify(token, JWT_SECRET);

          const user = await prisma.prisma.user.findUnique({
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
