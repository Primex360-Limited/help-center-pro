import { z } from "zod";

export const createTemplateSchema = z.object({
    name: z.string().trim().min(2).max(80),
    category: z.string().trim().min(1).max(40).optional(),
    content: z.string().min(1).max(5000),
    isActive: z.boolean().optional()
});

export const updateTemplateSchema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    content: z.string().min(1).max(5000).optional(),
    isActive: z.boolean().optional()
});

export const templateIdParamSchema = z.object({
    templateId: z.string().uuid()
});
