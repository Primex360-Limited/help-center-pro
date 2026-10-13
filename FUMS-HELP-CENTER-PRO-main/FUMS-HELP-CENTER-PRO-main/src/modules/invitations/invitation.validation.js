import { z } from "zod";
import { UUID_PATTERN } from "../../shared/utils/uuid.js";
import {
    isStrongPassword,
    strongPasswordSchemaMessage
} from "../../shared/utils/passwordPolicy.js";

const uuidSchema = z
    .string()
    .regex(UUID_PATTERN, "Invalid identifier")

const strongPassword = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(isStrongPassword, strongPasswordSchemaMessage);

export const createInvitationSchema = z
    .object({
        email: z.string().email(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        roleId: uuidSchema,
        /**
         * Workspace the agent joins. Optional: the controller falls back to the
         * request tenant / the inviter's own tenant. Only a provider super admin
         * normally needs to send it explicitly.
         */
        tenantId: uuidSchema.optional()
    })
    .transform((data) => {
        const localPart = String(data.email || "")
            .split("@")[0]
            .replace(/[._-]+/g, " ")
            .trim();
        const derivedFirst =
            localPart
                .split(/\s+/)
                .filter(Boolean)[0]
                ?.replace(/^\w/, (c) => c.toUpperCase()) || "Agent";

        return {
            ...data,
            firstName: data.firstName?.trim() || derivedFirst,
            lastName: data.lastName?.trim() || ""
        };
    });

export const acceptInvitationSchema = z
    .object({
        token: z.string().min(1),
        password: strongPassword,
        confirmPassword: z.string().min(8)
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Password confirmation does not match",
        path: ["confirmPassword"]
    });

export const previewInvitationSchema = z.object({
    token: z.string().min(1)
})