import { z } from "zod";
import {
    DEFAULT_TICKET_LIMIT,
    DEFAULT_TICKET_PAGE,
    CALL_DIRECTION,
    MAX_TICKET_LIMIT,
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_PRIORITY,
    TICKET_STATUS
} from "./ticket.constants.js";

const ticketStatusValues = Object.values(TICKET_STATUS);
const ticketPriorityValues = Object.values(TICKET_PRIORITY);
const ticketChannelValues = Object.values(TICKET_CHANNEL);
const senderTypeValues = Object.values(SENDER_TYPE);
const callDirectionValues = Object.values(CALL_DIRECTION);
const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Assigned user identifier must be a valid MongoDB user id");

export const ticketIdParamSchema = z.object({
    ticketId: z.string().min(1, "Ticket identifier is required")
});

export const createTicketSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    priority: z.enum(ticketPriorityValues).optional(),
    assignedToUserId: objectIdSchema.optional(),
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().min(1).optional(),
    customerIp: z.string().min(1).optional(),
    resolutionDueAt: z.coerce.date().optional(),
    channel: z.enum(ticketChannelValues).optional(),
    chat: z.object({
        message: z.string().min(1).optional(),
        senderType: z.enum(senderTypeValues).optional()
    }).optional(),
    email: z.object({
        subject: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        fromEmail: z.string().email().optional(),
        toEmail: z.string().email().optional(),
        senderType: z.enum(senderTypeValues).optional()
    }).optional(),
    call: z.object({
        duration: z.coerce.number().int().min(0).optional(),
        recordingUrl: z.string().url().optional(),
        direction: z.enum(callDirectionValues).optional()
    }).optional()
});

export const listTicketsQuerySchema = z.object({
    status: z.enum(ticketStatusValues).optional(),
    priority: z.enum(ticketPriorityValues).optional(),
    assignedToUserId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_TICKET_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_TICKET_LIMIT).default(DEFAULT_TICKET_LIMIT)
});
