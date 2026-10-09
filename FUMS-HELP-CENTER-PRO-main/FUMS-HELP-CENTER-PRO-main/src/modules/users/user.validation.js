import { z } from "zod";
import { USER_STATUS } from "../../shared/constants/system.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier");

export const userIdParamSchema = z.object({
  id: objectIdSchema
});

export const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImage: z.string().optional(),
  phoneNumber: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  roleId: z.union([objectIdSchema, z.null()]).optional(),
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