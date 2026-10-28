import prisma from "../../database/prisma/client.js";
import { env } from "../../config/env.js";
import {
    CALL_ACTOR,
    CALL_DIRECTION,
    CALL_EVENT_TYPE,
    SENDER_TYPE,
    TICKET_CHANNEL,
    TICKET_EVENT_TYPE,
    TICKET_PRIORITY,
    TICKET_STATUS
} from "./ticket.constants.js";

const DEMO_MARKER = "hcp_demo_seed_v1";

function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || "A").slice(0, 2).toUpperCase();
}

async function ensureTenantChannels(tenant) {
    const settings =
        tenant.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
            ? { ...tenant.settings }
            : {};

    let changed = false;
    if (!settings.supportEmail) {
        settings.supportEmail = "support@primex360.com";
        settings.supportEmailConnected = true;
        settings.supportEmailProvider = "connected";
        changed = true;
    }
    if (!Array.isArray(settings.callNumbers) || !settings.callNumbers.length) {
        settings.callNumbers = [
            {
                id: "num_demo_1",
                e164: "+15550100153",
                label: "Main support line",
                provisionedBy: "helpcentre_pro",
                status: "active"
            },
            {
                id: "num_demo_2",
                e164: "+15550100154",
                label: "VIP line",
                provisionedBy: "helpcentre_pro",
                status: "active"
            }
        ];
        changed = true;
    }
    if (!settings.widgetApiKeyPrefix) {
        settings.widgetApiKeyPrefix = "hcp_live_demo";
        settings.widgetApiKeyHint =
            "Generate a live key in Settings → Integrations. Customers appear when your app chat uses this key.";
        changed = true;
    }

    if (!changed) return tenant;

    return prisma.tenant.update({
        where: { id: tenant.id },
        data: { settings }
    });
}

async function createEmailTicket({
    ticketId,
    title,
    description,
    status,
    priority,
    customer,
    assignee,
    actor,
    createdAt,
    inboundBody,
    agentReply
}) {
    const ticket = await prisma.ticket.create({
        data: {
            ticketId,
            tenantId: actor.tenantId,
            title,
            description,
            status,
            priority,
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone || null,
            assignedToUserId: assignee?.id || null,
            assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
            assignedToEmail: assignee?.email || null,
            createdByUserId: actor.id,
            createdByName: `${actor.firstName} ${actor.lastName}`,
            createdByEmail: actor.email,
            updatedByUserId: actor.id,
            updatedByName: `${actor.firstName} ${actor.lastName}`,
            updatedByEmail: actor.email,
            createdAt,
            updatedAt: createdAt,
            lastCustomerResponseAt: createdAt,
            lastAgentResponseAt: agentReply ? hoursAgo(1) : null,
            resolutionDueAt: hoursAgo(-24)
        }
    });

    const inboundEvent = await prisma.ticketEvent.create({
        data: {
            ticketId: ticket.id,
            type: TICKET_EVENT_TYPE.EMAIL,
            channel: TICKET_CHANNEL.EMAIL,
            createdBy: SENDER_TYPE.CUSTOMER,
            createdAt,
            metadata: {
                demo: DEMO_MARKER,
                actor: {
                    type: SENDER_TYPE.CUSTOMER,
                    name: customer.name,
                    email: customer.email
                },
                email: { direction: "INBOUND" }
            },
            email: {
                create: {
                    subject: title,
                    body: inboundBody,
                    fromEmail: customer.email,
                    toEmail: "support@primex360.com"
                }
            }
        }
    });

    if (agentReply && assignee) {
        await prisma.ticketEvent.create({
            data: {
                ticketId: ticket.id,
                type: TICKET_EVENT_TYPE.EMAIL,
                channel: TICKET_CHANNEL.EMAIL,
                createdBy: SENDER_TYPE.AGENT,
                createdAt: hoursAgo(1),
                metadata: {
                    demo: DEMO_MARKER,
                    actor: {
                        type: SENDER_TYPE.AGENT,
                        userId: assignee.id,
                        name: `${assignee.firstName} ${assignee.lastName}`,
                        email: assignee.email
                    },
                    email: { direction: "OUTBOUND" }
                },
                email: {
                    create: {
                        subject: `Re: ${title}`,
                        body: agentReply,
                        fromEmail: "support@primex360.com",
                        toEmail: customer.email
                    }
                }
            }
        });

        await prisma.ticketMessage.create({
            data: {
                ticketRefId: ticket.id,
                senderUserId: assignee.id,
                senderName: `${assignee.firstName} ${assignee.lastName}`,
                senderEmail: assignee.email,
                messageType: "message",
                content: agentReply,
                createdAt: hoursAgo(1)
            }
        });
    }

    await prisma.ticketStatusHistory.create({
        data: {
            ticketRefId: ticket.id,
            oldStatus: null,
            newStatus: status === TICKET_STATUS.RESOLVED ? TICKET_STATUS.OPEN : status,
            changedByUserId: actor.id,
            changedByName: `${actor.firstName} ${actor.lastName}`,
            changedByEmail: actor.email,
            createdAt
        }
    });

    if (status === TICKET_STATUS.RESOLVED) {
        await prisma.ticketStatusHistory.create({
            data: {
                ticketRefId: ticket.id,
                oldStatus: TICKET_STATUS.OPEN,
                newStatus: TICKET_STATUS.RESOLVED,
                changedByUserId: assignee?.id || actor.id,
                changedByName: assignee
                    ? `${assignee.firstName} ${assignee.lastName}`
                    : `${actor.firstName} ${actor.lastName}`,
                changedByEmail: assignee?.email || actor.email,
                createdAt: new Date()
            }
        });
    }

    return { ticket, inboundEvent };
}

async function createChatTicket({
    ticketId,
    title,
    description,
    status,
    priority,
    customer,
    assignee,
    actor,
    createdAt,
    messages
}) {
    const ticket = await prisma.ticket.create({
        data: {
            ticketId,
            tenantId: actor.tenantId,
            title,
            description,
            status,
            priority,
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email,
            assignedToUserId: assignee?.id || null,
            assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
            assignedToEmail: assignee?.email || null,
            createdByUserId: actor.id,
            createdByName: `${actor.firstName} ${actor.lastName}`,
            createdByEmail: actor.email,
            createdAt,
            updatedAt: createdAt,
            queuedAt: status === TICKET_STATUS.QUEUED ? createdAt : null,
            lastCustomerResponseAt: createdAt,
            resolutionDueAt: hoursAgo(-24)
        }
    });

    await prisma.ticketEvent.create({
        data: {
            ticketId: ticket.id,
            type: TICKET_EVENT_TYPE.CHAT,
            channel: TICKET_CHANNEL.CHAT,
            createdBy: SENDER_TYPE.CUSTOMER,
            createdAt,
            metadata: {
                demo: DEMO_MARKER,
                actor: {
                    type: SENDER_TYPE.CUSTOMER,
                    name: customer.name,
                    email: customer.email
                }
            },
            chat: {
                create: {
                    message: messages[0]?.content || description,
                    senderType: SENDER_TYPE.CUSTOMER
                }
            }
        }
    });

    for (const msg of messages) {
        await prisma.ticketMessage.create({
            data: {
                ticketRefId: ticket.id,
                senderUserId: msg.senderUserId || customer.id,
                senderName: msg.senderName,
                senderEmail: msg.senderEmail,
                messageType: "message",
                content: msg.content,
                createdAt: msg.createdAt || createdAt
            }
        });
    }

    await prisma.ticketStatusHistory.create({
        data: {
            ticketRefId: ticket.id,
            oldStatus: null,
            newStatus: status,
            changedByUserId: actor.id,
            changedByName: `${actor.firstName} ${actor.lastName}`,
            changedByEmail: actor.email,
            createdAt
        }
    });

    return ticket;
}

async function createCallTicket({
    ticketId,
    title,
    description,
    status,
    priority,
    customer,
    assignee,
    actor,
    createdAt,
    duration,
    recordingUrl,
    direction,
    transcript,
    quality
}) {
    const ticket = await prisma.ticket.create({
        data: {
            ticketId,
            tenantId: actor.tenantId,
            title,
            description,
            status,
            priority,
            customerId: customer.id,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            assignedToUserId: assignee?.id || null,
            assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}` : null,
            assignedToEmail: assignee?.email || null,
            createdByUserId: actor.id,
            createdByName: `${actor.firstName} ${actor.lastName}`,
            createdByEmail: actor.email,
            createdAt,
            updatedAt: createdAt,
            lastCustomerResponseAt: createdAt,
            resolutionDueAt: hoursAgo(-24)
        }
    });

    const event = await prisma.ticketEvent.create({
        data: {
            ticketId: ticket.id,
            type: TICKET_EVENT_TYPE.CALL,
            channel: TICKET_CHANNEL.PHONE,
            createdBy: CALL_ACTOR.CUSTOMER,
            createdAt,
            metadata: {
                demo: DEMO_MARKER,
                actor: {
                    type: CALL_ACTOR.CUSTOMER,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone
                },
                transcript,
                quality,
                callStatus: "completed"
            },
            call: {
                create: {
                    duration,
                    recordingUrl,
                    logs: {
                        create: [
                            {
                                eventType: CALL_EVENT_TYPE.CALL_INITIATED,
                                actor: CALL_ACTOR.CUSTOMER,
                                direction,
                                timestamp: createdAt
                            },
                            {
                                eventType: CALL_EVENT_TYPE.CALL_PICKED,
                                actor: CALL_ACTOR.AGENT,
                                direction,
                                timestamp: new Date(createdAt.getTime() + 12_000)
                            },
                            {
                                eventType: CALL_EVENT_TYPE.CALL_HANGUP,
                                actor: CALL_ACTOR.CUSTOMER,
                                direction,
                                timestamp: new Date(createdAt.getTime() + duration * 1000)
                            }
                        ]
                    }
                }
            }
        }
    });

    await prisma.ticketStatusHistory.create({
        data: {
            ticketRefId: ticket.id,
            oldStatus: null,
            newStatus: status,
            changedByUserId: actor.id,
            changedByName: `${actor.firstName} ${actor.lastName}`,
            changedByEmail: actor.email,
            createdAt
        }
    });

    if (status === TICKET_STATUS.RESOLVED && assignee) {
        await prisma.ticketStatusHistory.create({
            data: {
                ticketRefId: ticket.id,
                oldStatus: TICKET_STATUS.OPEN,
                newStatus: TICKET_STATUS.RESOLVED,
                changedByUserId: assignee.id,
                changedByName: `${assignee.firstName} ${assignee.lastName}`,
                changedByEmail: assignee.email,
                createdAt: new Date()
            }
        });
    }

    return { ticket, event };
}

/**
 * Seeds realistic EMAIL / CHAT / PHONE tickets for the demo tenant so Emails,
 * Live Chat, Calls, and Top agents today can be tested with accurate data.
 */
export async function seedDemoTickets() {
    // Demo seeding is opt-in only. Never auto-seed workspace data.
    if (!env.SEED_DEMO_TICKETS) {
        return null;
    }
    if (env.NODE_ENV === "production") {
        console.warn("[seedDemoTickets] Refusing to seed demo tickets in production");
        return null;
    }

    const tenant = await prisma.tenant.findFirst({
        where: { slug: "primex360" }
    });
    if (!tenant) {
        console.warn("[seedDemoTickets] Demo tenant primex360 not found — skip");
        return null;
    }

    await ensureTenantChannels(tenant);

    // Detect seed data by demo emails only — never by TK-##### (real tickets
    // share that public id format).
    const already = await prisma.ticket.findFirst({
        where: {
            OR: [
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
    if (already) {
        console.log("[seedDemoTickets] Demo tickets already present — skip");
        return null;
    }

    const agents = await prisma.user.findMany({
        where: {
            tenantId: tenant.id,
            userType: "tenant",
            status: "active"
        },
        orderBy: { createdAt: "asc" },
        take: 6
    });

    if (!agents.length) {
        console.warn("[seedDemoTickets] No tenant agents — skip");
        return null;
    }

    const [olivia, amaka, joseph] = [
        agents.find((u) => u.email.includes("admin@helpcentrepro")) || agents[0],
        agents.find((u) => u.email.includes("amaka")) || agents[0],
        agents.find((u) => u.email.includes("jetsam")) || agents[Math.min(1, agents.length - 1)]
    ];

    const customers = [
        {
            id: "cus_sarah_chen",
            name: "Sarah Chen",
            email: "sarah.chen@example.com",
            phone: "+2347062755215"
        },
        {
            id: "cus_david_lee",
            name: "David Lee",
            email: "david.lee@example.com",
            phone: "+15551234001"
        },
        {
            id: "cus_priya_shah",
            name: "Priya Shah",
            email: "priya.shah@example.com",
            phone: "+15551234002"
        },
        {
            id: "cus_james_wilson",
            name: "James Wilson",
            email: "james.wilson@example.com",
            phone: "+15551234003"
        },
        {
            id: "cus_ayepeace",
            name: "ayepeace",
            email: "ayepeace@gmail.com",
            phone: "+15551234004"
        }
    ];

    // EMAIL tickets
    await createEmailTicket({
        ticketId: "TK-00001",
        title: "How to integrate with third-party tools?",
        description: "Need documentation for Zapier and Slack integrations.",
        status: TICKET_STATUS.RESOLVED,
        priority: TICKET_PRIORITY.LOW,
        customer: customers[1],
        assignee: olivia,
        actor: olivia,
        createdAt: hoursAgo(5),
        inboundBody:
            "Hi team,\n\nHow do we integrate Help Centre Pro with our third-party tools (Zapier, Slack)?\n\nThanks,\nDavid",
        agentReply:
            "Hi David,\n\nYou can connect integrations from Settings → Automations. I've attached our Zapier guide.\n\nBest,\nOlivia"
    });

    await createEmailTicket({
        ticketId: "TK-00002",
        title: "Unable to access dashboard after password reset",
        description: "Customer cannot log in after resetting password.",
        status: TICKET_STATUS.PENDING,
        priority: TICKET_PRIORITY.MEDIUM,
        customer: customers[0],
        assignee: amaka,
        actor: olivia,
        createdAt: hoursAgo(72),
        inboundBody:
            "Hello,\n\nI reset my password but still cannot access the dashboard. It keeps looping back to login.\n\nSarah Chen",
        agentReply:
            "Hi Sarah,\n\nPlease try clearing your browser cache and cookies, then sign in again in a private window.\n\nShekinah / Support"
    });

    await createEmailTicket({
        ticketId: "TK-00003",
        title: "Billing invoice for March",
        description: "Requesting a copy of the March invoice.",
        status: TICKET_STATUS.OPEN,
        priority: TICKET_PRIORITY.LOW,
        customer: customers[2],
        assignee: joseph,
        actor: olivia,
        createdAt: hoursAgo(2),
        inboundBody: "Could you resend our March invoice to accounting?",
        agentReply: null
    });

    await createEmailTicket({
        ticketId: "TK-00004",
        title: "Update company billing address",
        description: "Need to update billing address on file.",
        status: TICKET_STATUS.OPEN,
        priority: TICKET_PRIORITY.MEDIUM,
        customer: customers[3],
        assignee: olivia,
        actor: olivia,
        createdAt: hoursAgo(0.2),
        inboundBody: "Please update our billing address to 120 Market Street.",
        agentReply: null
    });

    // CHAT tickets
    await createChatTicket({
        ticketId: "TK-00005",
        title: "Live chat — dashboard access",
        description: "Customer cannot access dashboard after password reset.",
        status: TICKET_STATUS.OPEN,
        priority: TICKET_PRIORITY.HIGH,
        customer: customers[0],
        assignee: olivia,
        actor: olivia,
        createdAt: hoursAgo(0.1),
        messages: [
            {
                senderUserId: customers[0].id,
                senderName: customers[0].name,
                senderEmail: customers[0].email,
                content: "Hi, I still can't get into the dashboard after resetting my password.",
                createdAt: hoursAgo(0.1)
            },
            {
                senderUserId: olivia.id,
                senderName: `${olivia.firstName} ${olivia.lastName}`,
                senderEmail: olivia.email,
                content: "Hi Sarah — I'm looking into this with you now.",
                createdAt: hoursAgo(0.05)
            }
        ]
    });

    await createChatTicket({
        ticketId: "TK-00006",
        title: "Quick question about agents",
        description: "How many agents can I invite on Scale?",
        status: TICKET_STATUS.QUEUED,
        priority: TICKET_PRIORITY.LOW,
        customer: customers[2],
        assignee: null,
        actor: olivia,
        createdAt: hoursAgo(0.3),
        messages: [
            {
                senderUserId: customers[2].id,
                senderName: customers[2].name,
                senderEmail: customers[2].email,
                content: "How many agents can I invite on the Scale plan?",
                createdAt: hoursAgo(0.3)
            }
        ]
    });

    // CALL tickets with recording + transcript
    const sampleRecording =
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    await createCallTicket({
        ticketId: "TK-00007",
        title: "Unable to access dashboard after password reset",
        description: "Inbound call about dashboard access after password reset.",
        status: TICKET_STATUS.PENDING,
        priority: TICKET_PRIORITY.MEDIUM,
        customer: customers[0],
        assignee: amaka,
        actor: olivia,
        createdAt: hoursAgo(72),
        duration: 332,
        recordingUrl: sampleRecording,
        direction: CALL_DIRECTION.INBOUND,
        quality: {
            network: "Good",
            audioClarity: "Good",
            stability: "Good"
        },
        transcript: [
            {
                at: "00:12",
                speaker: "Sarah Chen",
                role: "customer",
                text: "Hi, I reset my password but the dashboard still won't open."
            },
            {
                at: "00:25",
                speaker: "Susan Ehis",
                role: "agent",
                text: "Sorry about that Sarah. Let me walk you through clearing the cache."
            },
            {
                at: "01:05",
                speaker: "Sarah Chen",
                role: "customer",
                text: "Okay, I cleared it. Trying again now."
            },
            {
                at: "03:12",
                speaker: "Susan Ehis",
                role: "agent",
                text: "Great — once you're in, set a new password from Profile → Security."
            }
        ]
    });

    await createCallTicket({
        ticketId: "TK-00008",
        title: "Wallet funding failing on mobile",
        description: "Customer reports wallet funding failures on iOS.",
        status: TICKET_STATUS.RESOLVED,
        priority: TICKET_PRIORITY.HIGH,
        customer: customers[3],
        assignee: joseph,
        actor: olivia,
        createdAt: hoursAgo(4),
        duration: 418,
        recordingUrl: sampleRecording,
        direction: CALL_DIRECTION.INBOUND,
        quality: {
            network: "Good",
            audioClarity: "Fair",
            stability: "Good"
        },
        transcript: [
            {
                at: "00:08",
                speaker: "James Wilson",
                role: "customer",
                text: "Payments keep failing when I try to fund my wallet."
            },
            {
                at: "00:40",
                speaker: `${joseph.firstName} ${joseph.lastName}`,
                role: "agent",
                text: "Thanks James. Was this on Wi-Fi or mobile data?"
            }
        ]
    });

    // Extra resolutions today for Top agents ranking (Olivia, Amaka, Joseph)
    for (const [idx, agent] of [olivia, amaka, joseph, olivia].entries()) {
        const t = await prisma.ticket.create({
            data: {
                ticketId: `TK-${String(9 + idx).padStart(5, "0")}`,
                tenantId: tenant.id,
                title: `Resolved sample #${idx + 1}`,
                description: "Seeded resolved ticket for Top agents today ranking.",
                status: TICKET_STATUS.RESOLVED,
                priority: TICKET_PRIORITY.LOW,
                customerName: customers[idx % customers.length].name,
                customerEmail: customers[idx % customers.length].email,
                customerId: customers[idx % customers.length].id,
                assignedToUserId: agent.id,
                assignedToName: `${agent.firstName} ${agent.lastName}`,
                assignedToEmail: agent.email,
                createdByUserId: agent.id,
                createdByName: `${agent.firstName} ${agent.lastName}`,
                createdByEmail: agent.email,
                createdAt: hoursAgo(6 + idx),
                updatedAt: new Date()
            }
        });
        await prisma.ticketEvent.create({
            data: {
                ticketId: t.id,
                type: TICKET_EVENT_TYPE.CHAT,
                channel: TICKET_CHANNEL.CHAT,
                createdBy: SENDER_TYPE.AGENT,
                metadata: { demo: DEMO_MARKER },
                chat: {
                    create: {
                        message: "Issue resolved.",
                        senderType: SENDER_TYPE.AGENT
                    }
                }
            }
        });
        await prisma.ticketStatusHistory.create({
            data: {
                ticketRefId: t.id,
                oldStatus: TICKET_STATUS.OPEN,
                newStatus: TICKET_STATUS.RESOLVED,
                changedByUserId: agent.id,
                changedByName: `${agent.firstName} ${agent.lastName}`,
                changedByEmail: agent.email,
                createdAt: new Date()
            }
        });
    }

    console.log(
        `[seedDemoTickets] Seeded demo EMAIL/CHAT/PHONE tickets for ${tenant.slug} (agents: ${agents.map((a) => a.firstName).join(", ")}; ${initials(olivia.firstName + " " + olivia.lastName)})`
    );
    return true;
}

export default seedDemoTickets;
