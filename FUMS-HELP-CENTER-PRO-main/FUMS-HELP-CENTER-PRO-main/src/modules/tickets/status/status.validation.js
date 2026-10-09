import { z } from "zod";
import { TICKET_STATUS } from "../ticket.constants.js";

export const updateTicketStatusSchema = z.object({
    status: z.enum(Object.values(TICKET_STATUS))
});