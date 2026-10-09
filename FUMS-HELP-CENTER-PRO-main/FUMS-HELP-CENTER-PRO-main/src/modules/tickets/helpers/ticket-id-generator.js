import crypto from "crypto";
import { TICKET_ID_PREFIX } from "../ticket.constants.js";

function buildCandidateTicketId() {
    const dateSegment = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSegment = crypto.randomBytes(3).toString("hex").toUpperCase();

    return `${TICKET_ID_PREFIX}-${dateSegment}-${randomSegment}`;
}

export async function generateUniqueTicketId(existsFn, attempts = 5) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = buildCandidateTicketId();
        const exists = await existsFn(candidate);

        if (!exists) {
            return candidate;
        }
    }

    throw new Error("Unable to generate a unique ticket identifier");
}

export default generateUniqueTicketId;