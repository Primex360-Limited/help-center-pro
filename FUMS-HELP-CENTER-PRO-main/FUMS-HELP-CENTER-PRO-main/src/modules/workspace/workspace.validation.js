import { z } from "zod";

/**
 * Organisation profile payload for the tenant-admin workspace settings screen
 * (name, logo, default timezone).
 *
 * The logo is accepted either as an inline `data:` URL produced by an in-app
 * upload (FileReader) or as a public `https:` URL, which keeps the tenant
 * service free of any multipart/object-storage dependency.
 */
const DATA_URL_PATTERN =
    /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

const HTTPS_URL_PATTERN = /^https:\/\/[^\s]+$/i;

/** ~300KB after base64 encoding (base64 inflates the raw file by ~33%). */
const MAX_LOGO_LENGTH = 400000;

const logoUrlSchema = z
    .string()
    .trim()
    .max(MAX_LOGO_LENGTH, "Logo must be 300KB or smaller")
    .refine(
        (value) =>
            DATA_URL_PATTERN.test(value) || HTTPS_URL_PATTERN.test(value),
        "Logo must be an uploaded PNG/JPG/WEBP/GIF/SVG image or an https URL"
    );

export const updateCallingSettingsSchema = z.object({
    mode: z.enum(["hcp", "own"]).optional(),
    hcpPaused: z.boolean().optional(),
    ownNumber: z
        .union([z.literal(""), z.string().trim().min(5).max(32)])
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
});

export const updateWorkspaceProfileSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, "Workspace name must be at least 2 characters")
            .max(80, "Workspace name must be 80 characters or fewer")
            .optional(),
        /** Empty string clears the stored logo. */
        logoUrl: z.union([z.literal(""), logoUrlSchema]).optional(),
        timezone: z
            .string()
            .trim()
            .min(1, "Timezone is required")
            .max(64, "Timezone is too long")
            .optional(),
        /** Tenant mailbox used when agents send email from Help Centre Pro. */
        supportEmail: z
            .union([z.literal(""), z.string().trim().email().max(254)])
            .optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Provide at least one field to update"
    });
