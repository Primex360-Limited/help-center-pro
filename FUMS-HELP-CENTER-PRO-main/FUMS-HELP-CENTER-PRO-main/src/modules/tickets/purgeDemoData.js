import prisma from "../../database/prisma/client.js";

/** Known seed/demo customer emails from `seedDemoTickets` — never real traffic. */
const DEMO_CUSTOMER_EMAILS = Object.freeze([
    "sarah.chen@example.com",
    "david.okafor@example.com",
    "james.wilson@example.com",
    "ayepeace@gmail.com"
]);

/**
 * Remove only known seed / demo tickets.
 *
 * IMPORTANT: Real public IDs are `TK-00001`, `TK-00019`, … — never match on
 * `TK-000*` or every boot wipes live chat and support history.
 */
export async function purgeDemoTickets() {
    const result = await prisma.ticket.deleteMany({
        where: {
            OR: [
                { ticketId: { startsWith: "TCKT-20260512-" } },
                {
                    customerEmail: {
                        in: [...DEMO_CUSTOMER_EMAILS]
                    }
                }
            ]
        }
    });

    if (result.count > 0) {
        console.log(`[purgeDemoTickets] Removed ${result.count} demo/seed ticket(s)`);
    }

    return result.count;
}

export default purgeDemoTickets;
