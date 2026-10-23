import prisma from "../../database/prisma/client.js";

/**
 * Permanently remove known seed / demo tickets so workspaces only show
 * real customer data. Safe to run on every boot (idempotent).
 */
export async function purgeDemoTickets() {
    const result = await prisma.ticket.deleteMany({
        where: {
            OR: [
                { ticketId: { startsWith: "TK-000" } },
                { ticketId: { startsWith: "TCKT-20260512-" } },
                {
                    customerEmail: {
                        in: [
                            "sarah.chen@example.com",
                            "david.okafor@example.com",
                            "james.wilson@example.com",
                            "ayepeace@gmail.com"
                        ]
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
