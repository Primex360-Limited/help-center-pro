import { z } from "zod";

/**
 * Email Account Validation Schemas
 */

export const emailAccountCreateSchema = z
  .object({
    provider: z.enum(["gmail", "outlook", "custom"]),
    email: z.string().email("Invalid email address"),
    displayName: z.string().optional(),
    /** App password for custom IMAP/SMTP accounts (encrypted at rest). */
    password: z.string().min(1).optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    tokenExpiresAt: z.string().optional(),
    imapHost: z.string().optional(),
    imapPort: z.number().int().positive().optional(),
    imapSecure: z.boolean().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().positive().optional(),
    smtpSecure: z.boolean().optional(),
    isDefault: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    if (data.provider === "custom" && !data.password && !data.accessToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "App password is required for a custom mailbox"
      });
    }
  });

export const emailAccountUpdateSchema = z.object({
  displayName: z.string().optional(),
  password: z.string().min(1).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().int().positive().optional(),
  imapSecure: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpSecure: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  syncEnabled: z.boolean().optional()
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().optional()
});

export const accountIdParamSchema = z.object({
  accountId: z.string().uuid("Invalid account ID")
});
