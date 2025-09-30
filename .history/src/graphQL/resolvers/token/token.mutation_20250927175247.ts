import jwt from "jsonwebtoken";
import { extendType } from "nexus";
const REFRESH_SECRET = process.env.REFRESH_SECRET;


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
        try {
          const payload = jwt.verify(token, REFRESH_SECRET);

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
