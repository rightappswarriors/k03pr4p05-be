import jwt from "jsonwebtoken";
import { extendType } from "nexus";
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const JWT_SECRET = process.env.JWT_SECRET

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

          const user = await prisma.user.findUnique({
            where: {
              id: payload.userId,
            },
          });
          if (!user) throw new Error("User not found");
          const newAccessToken = jwt.sign(
            { userId: user.id, role: user.role, email: user.email},
            JWT_SECRET
          )
        } catch (error) {
          console.error("Error refreshing token", error);
          throw new Error("Error refreshing token.");
        }
      },
    });
  },
});
