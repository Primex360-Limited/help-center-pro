import { z } from "zod";
import {
    isStrongPassword,
    strongPasswordSchemaMessage
} from "../../shared/utils/passwordPolicy.js";

const strongPassword = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(isStrongPassword, strongPasswordSchemaMessage);

export const registerSchema = z.object({
    email: z.string().email("Invalid email"),
    password: strongPassword,
    firstName: z.string().min(2, "Name must be at least 2 characters"),
    lastName: z.string().min(2, "Name must be at least 2 characters")
});

/** Public workspace signup (matches Create account UI: full name + email + password). */
export const workspaceSignupSchema = z
    .object({
        fullName: z.string().min(2, "Name must be at least 2 characters").max(120),
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters").max(128),
        confirmPassword: z.string().min(8, "Password must be at least 8 characters")
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Password confirmation does not match",
        path: ["confirmPassword"]
    });

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password is required")
});

export const googleAuthSchema = z.object({
    idToken: z.string().min(20, "Firebase ID token is required")
});

export const verifyEmailSchema = z.object({
    token: z.string().min(1),
});

export const emailOnlySchema = z.object({
    email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: strongPassword,
    confirmPassword: z.string().min(8),
}).refine(
    (data) => data.password === data.confirmPassword,
    {
        message: "Password confirmation does not match",
        path: ["confirmPassword"]
    }
);

export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(8)
}).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
        message: "Password confirmation does not match",
        path: ["confirmPassword"]
    }
);

const COMPANY_SIZES = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201+ employees"
];

const LANGUAGE_CODES = [
    "en",
    "es",
    "fr",
    "de",
    "zh",
    "ja",
    "pt",
    "ru",
    "ar",
    "hi"
];

/** Company details after email verification (signup step 3). */
export const completeProfileSchema = z.object({
    email: z.string().email("Invalid email"),
    companyName: z.string().min(2, "Company name is required").max(120),
    website: z
        .string()
        .max(180)
        .optional()
        .transform((value) => {
            const trimmed = String(value || "").trim();
            if (!trimmed) return null;
            if (/^https?:\/\//i.test(trimmed)) return trimmed;
            return `https://${trimmed}`;
        }),
    timezone: z.string().min(2).max(80),
    industry: z.string().min(2).max(80),
    language: z.enum(LANGUAGE_CODES, {
        errorMap: () => ({ message: "Select a supported language" })
    }),
    companySize: z.enum(COMPANY_SIZES, {
        errorMap: () => ({ message: "Select a valid company size" })
    })
});

export { COMPANY_SIZES, LANGUAGE_CODES };
