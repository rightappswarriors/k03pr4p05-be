import { extendType, arg, nonNull, objectType } from "nexus";
import * as userAPIKey from "../../../services/user.service.js";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";


export const ApiMutation = 