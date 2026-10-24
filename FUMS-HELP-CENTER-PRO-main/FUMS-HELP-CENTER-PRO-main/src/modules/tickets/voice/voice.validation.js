import { z } from "zod";

export const placeOutboundCallSchema = z.object({
    to: z.string().min(5, "Destination phone number is required"),
    ticketId: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    title: z.string().min(1).optional(),
    /** ISO country for bare national numbers, e.g. NG, GH, US, GB. +/00 numbers ignore this. */
    defaultRegion: z
        .string()
        .regex(/^[A-Za-z]{2}$/)
        .transform((v) => v.toUpperCase())
        .optional()
});

export const startInboundSipCallSchema = z.object({
    from: z.string().min(3, "Caller number is required"),
    to: z.string().min(3).optional(),
    ticketId: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    title: z.string().min(1).optional(),
    callSid: z.string().min(1).optional(),
    defaultRegion: z
        .string()
        .regex(/^[A-Za-z]{2}$/)
        .transform((v) => v.toUpperCase())
        .optional()
});

const transcriptLineSchema = z.object({
    speaker: z.string().optional(),
    role: z.string().optional(),
    text: z.string().min(1),
    time: z.string().optional(),
    at: z.string().optional(),
    timestamp: z.string().optional(),
    name: z.string().optional(),
    message: z.string().optional()
});

export const completeSipCallSchema = z.object({
    ticketId: z.string().min(1, "ticketId is required"),
    callSid: z.string().min(1).optional(),
    durationSeconds: z.coerce.number().min(0).optional(),
    status: z.string().min(1).optional(),
    recordingUrl: z.string().min(1).optional().nullable(),
    recordingDataUrl: z
        .string()
        .min(32)
        .regex(/^data:audio\//i, "recordingDataUrl must be an audio data URL")
        .optional()
        .nullable(),
    transcript: z.array(transcriptLineSchema).optional().nullable(),
    quality: z
        .object({
            network: z.union([z.string(), z.number()]).optional(),
            Network: z.union([z.string(), z.number()]).optional(),
            audioClarity: z.union([z.string(), z.number()]).optional(),
            audio: z.union([z.string(), z.number()]).optional(),
            "Audio clarity": z.union([z.string(), z.number()]).optional(),
            stability: z.union([z.string(), z.number()]).optional(),
            Stability: z.union([z.string(), z.number()]).optional(),
            packetLoss: z.union([z.string(), z.number()]).optional(),
            jitterMs: z.union([z.string(), z.number()]).optional(),
            rttMs: z.union([z.string(), z.number()]).optional()
        })
        .passthrough()
        .optional()
        .nullable(),
    summary: z.string().max(4000).optional().nullable()
});
