import { z } from "zod";
import { USER_STATUS } from "../../shared/constants/system.js";
import { UUID_PATTERN } from "../../shared/utils/uuid.js";

/** Every identity-layer primary key is a Postgres `uuid`. */
const uuidSchema = z
  .string()
  .regex(UUID_PATTERN, "Invalid identifier");


export const userIdParamSchema = z.object({
  id: uuidSchema
});

export const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImage: z.string().optional(),
  phoneNumber: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  roleId: z.union([uuidSchema, z.null()]).optional(),
  status: z.enum([
    USER_STATUS.ACTIVE,
    USER_STATUS.INACTIVE,
    USER_STATUS.SUSPENDED
  ]).optional(),
  deniedPermissions: z.array(z.string().min(1)).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Provide at least one field to update"
  }
);