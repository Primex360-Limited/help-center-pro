import { z } from "zod";
import {
    CALL_DIRECTION,
    SENDER_TYPE,
    TICKET_CHANNEL
} from "../ticket.constants.js";

const ticketChannelValues = Object.values(TICKET_CHANNEL);
const senderTypeValues = Object.values(SENDER_TYPE);
const callDirectionValues = Object.values(CALL_DIRECTION);

export const createTicketEventSchema = z.object({
    customerName: z.string().min(1).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().min(1).optional(),
    customerIp: z.string().min(1).optional(),
    channel: z.enum(ticketChannelValues),
    chat: z.object({
        message: z.string().min(1),
        senderType: z.enum(senderTypeValues).optional()
    }).optional(),
    email: z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
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
