import jwt from "jsonwebtoken"
import { extendType, objectType } from "nexus"
const JWT_SECRET = process.env.JWT_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET

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
     definition(t){
          t.nonNull.field("refreshToken", {
               type: "AuthPayload"
          })
     }
})