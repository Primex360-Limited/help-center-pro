import prisma from "../../../database/prisma/client.js";
import { TICKET_ID_PREFIX } from "../ticket.constants.js";

/** Postgres advisory lock key reserved for ticket ID allocation. */
const TICKET_ID_LOCK_KEY = 88442201;

/**
 * Public ticket IDs match the product UI: TK-00001, TK-00002, …
 * Grows past 5 digits automatically when the sequence exceeds 99999.
 */
export function formatPublicTicketId(sequence) {
    const n = Math.max(1, Math.floor(Number(sequence) || 1));
    const width = Math.max(5, String(n).length);
    return `${TICKET_ID_PREFIX}-${String(n).padStart(width, "0")}`;
}

async function maxSequenceInTx(tx) {
    const rows = await tx.$queryRawUnsafe(`
        SELECT MAX(
            CASE
                WHEN "ticketId" ~ '^TK-[0-9]+$'
                THEN CAST(SUBSTRING("ticketId" FROM 4) AS INTEGER)
                ELSE 0
            END
        ) AS max_seq
        FROM "Ticket"
    `);

    return Number(rows?.[0]?.max_seq) || 0;
}

/**
 * Allocate the next unused TK-##### id inside an open Prisma transaction.
 * Caller must hold / share the same tx so insert cannot race another allocator.
 */
export async function allocateUniqueTicketIdInTx(tx, attempts = 50) {
    await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${TICKET_ID_LOCK_KEY})`
    );

    const maxSeq = await maxSequenceInTx(tx);
    let sequence = maxSeq > 0 ? maxSeq + 1 : (await tx.ticket.count()) + 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = formatPublicTicketId(sequence + attempt);
        const existing = await tx.ticket.findUnique({
            where: { ticketId: candidate },
            select: { id: true }
        });
        if (!existing) {
            return candidate;
        }
    }

    throw new Error("Unable to generate a unique ticket identifier");
}

/**
 * Atomically allocate the next unused TK-##### id (standalone helper).
 */
export async function generateUniqueTicketId(_existsFn, attempts = 50) {
    return prisma.$transaction(
        async (tx) => allocateUniqueTicketIdInTx(tx, attempts),
        {
            maxWait: 10000,
            timeout: 15000
        }
    );
}

/** True when Prisma rejected an insert due to duplicate ticketId. */
export function isTicketIdUniqueConflict(error) {
    if (!error) return false;
    if (error.code === "P2002") {
        const target = error.meta?.target;
        if (Array.isArray(target)) {
            return target.includes("ticketId");
        }
        if (typeof target === "string") {
            return target.includes("ticketId");
        }
        return true;
    }
    const message = String(error.message || "");
    return /ticketId/i.test(message) && /unique/i.test(message);
}

export default generateUniqueTicketId;
