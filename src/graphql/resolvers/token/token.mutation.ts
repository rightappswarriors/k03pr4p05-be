import jwt from "jsonwebtoken";
import { extendType, nonNull, stringArg } from "nexus";

const REFRESH_SECRET = process.env.REFRESH_SECRET!;
const JWT_SECRET = process.env.JWT_SECRET!;

// ✅ Typed payload interface — avoids runtime undefined on payload.userId
interface JwtPayload {
  userId: number;
  role?: string;
  email?: string;
}

export const RefreshMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("me", {
      type: "User",
      async resolve(_, __, ctx) {
        const authHeader = ctx.req.authorization;
        if (!authHeader) return null;

        const token = authHeader.replace("Bearer ", "");
        try {
          // ✅ Was missing type assertion — payload.userId was undefined at runtime
          const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

          return await ctx.prisma.user.findUnique({
            where: { id: payload.userId },
          });
        } catch (error) {
          if (process.env.NODE_ENV === "development")
            console.error("Invalid token in me query:", error);
          return null;
        }
      },
    });

    t.nonNull.field("refreshToken", {
      type: "AuthPayload",
      args: {
        refresh_token: nonNull(stringArg()),
      },
      async resolve(_, { refresh_token }, { req, res, prisma }) {
        try {
          // ✅ Fix 1: Added type assertion — payload.userId was undefined without it
          const payload = jwt.verify(refresh_token, REFRESH_SECRET) as JwtPayload;

          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            // ✅ Fix 2: Include org + subscription so the returned user
            //    matches AuthPayload shape expected by the mobile app
            include: {
              org: {
                include: {
                  subscription: true,
                },
              },
            },
          });

          if (!user) throw new Error("User not found");

          const newAccessToken = jwt.sign(
            { userId: user.id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: "15m" }
          );

          const newRefreshToken = jwt.sign(
            { userId: user.id },
            REFRESH_SECRET,
            { expiresIn: "24h" }
          );

          res.cookie("jid", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/graphql",
          });

          return {
            user,
            token: newAccessToken,
            refresh_token: newRefreshToken,
          };
        } catch (error) {
          // ✅ Fix 4: Log the actual error message so you know WHY it failed
          //    (expired, malformed, wrong secret, user not found, etc.)
          if (process.env.NODE_ENV === "development")
            console.error("Error refreshing token:", error);

          // ✅ Fix 5: Distinguish token expiry from other errors so the
          //    client knows whether to prompt re-login vs retry
          if (error instanceof jwt.TokenExpiredError) {
            throw new Error("REFRESH_TOKEN_EXPIRED");
          }
          if (error instanceof jwt.JsonWebTokenError) {
            throw new Error("REFRESH_TOKEN_INVALID");
          }

          throw new Error("Error refreshing token.");
        }
      },
    });
  },
});
