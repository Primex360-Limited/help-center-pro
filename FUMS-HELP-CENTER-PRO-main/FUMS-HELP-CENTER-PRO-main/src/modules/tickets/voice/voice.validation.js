import { z } from "zod";

export const placeOutboundCallSchema = z.object({
    to: z.string().min(5, "Destination phone number is required"),
    ticketId: z.string().min(1).optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    title: z.string().min(1).optional(),
    defaultRegion: z.enum(["NG", "US", "GB", "GH", "KE", "ZA", "IN", "CA"]).optional()
});
