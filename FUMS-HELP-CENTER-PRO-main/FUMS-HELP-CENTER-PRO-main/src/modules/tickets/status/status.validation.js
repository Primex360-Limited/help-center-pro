import { z } from "zod";
import { TICKET_PRIORITY, TICKET_STATUS } from "../ticket.constants.js";

export const updateTicketStatusSchema = z.object({
    status: z.enum(Object.values(TICKET_STATUS))
});

export const updateTicketPrioritySchema = z.object({
    priority: z.enum(Object.values(TICKET_PRIORITY))
});