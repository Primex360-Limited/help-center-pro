import { z } from "zod";
import { UUID_PATTERN } from "../../shared/utils/uuid.js";

/** Every identity-layer primary key is a Postgres `uuid`. */
const uuidSchema = z
    .string()
    .regex(UUID_PATTERN, "Invalid identifier");

export const roleIdParamSchema = z.object({
    id: uuidSchema
});

export const createRoleSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    permissions: z.array(z.string().min(1)).min(1)
});

export const updateRoleSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    permissions: z.array(z.string().min(1)).min(1).optional()
}).refine(
    (data) => Object.keys(data).length > 0,
    { 
        message: "At least one field must be provided for update" 
    }

)