import { z } from "zod";
import {
    DEFAULT_TICKET_LIMIT,
    DEFAULT_TICKET_PAGE,
    MAX_TICKET_LIMIT
} from "../ticket.constants.js";

export const createMessageSchema = z.object({
    content: z.string().min(1, "Content is required")
});

export const listMessagesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(DEFAULT_TICKET_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_TICKET_LIMIT).default(DEFAULT_TICKET_LIMIT)
});