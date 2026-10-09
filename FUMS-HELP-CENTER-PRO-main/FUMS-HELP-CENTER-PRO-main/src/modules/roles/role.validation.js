import { z } from "zod";

const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId format");

export const roleIdParamSchema = z.object({
    id: objectIdSchema
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