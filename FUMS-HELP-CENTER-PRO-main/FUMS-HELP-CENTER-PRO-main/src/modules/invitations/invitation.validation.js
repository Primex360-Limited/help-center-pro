import { z } from "zod";

const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier")

export const createInvitationSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    roleId: objectIdSchema,
});

export const acceptInvitationSchema = z.object({
    token: z.string().min(1),
});

export const previewInvitationSchema = z.object({
    token: z.string().min(1)
})