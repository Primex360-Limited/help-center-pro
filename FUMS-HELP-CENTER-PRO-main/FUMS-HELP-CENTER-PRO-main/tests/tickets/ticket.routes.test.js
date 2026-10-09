import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const getTickets = jest.fn();
const getTicketThread = jest.fn();
const addEventToTicket = jest.fn();

const requireAuth = (req, res, next) => {
    req.user = { sub: "admin-id" };
    req.currentUser = {
        _id: "admin-id",
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        status: "active"
    };
    next();
};

const requirePermission = () => (req, res, next) => next();
const asyncHandler = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
const validate = (_schema, location = "body") => (req, res, next) => {
    if (location === "query") {
        req.validatedQuery = req.query;
    } else if (location === "params") {
        req.validatedParams = req.params;
    } else {
        req.validatedBody = req.body;
    }

    next();
};

jest.unstable_mockModule("../../src/middleware/async.middleware.js", () => ({
    default: asyncHandler
}));

jest.unstable_mockModule(
    "../../src/middleware/validate.middleware.js",
    () => ({
        validate
    })
);

jest.unstable_mockModule(
    "../../src/modules/middleware/auth.middleware.js",
    () => ({
        requireAuth
    })
);

jest.unstable_mockModule(
    "../../src/modules/roles/rbac.middleware.js",
    () => ({
        requirePermission
    })
);

jest.unstable_mockModule(
    "../../src/modules/tickets/ticket.service.js",
    () => ({
        createTicket: jest.fn(),
        getTicketDetail: jest.fn(),
        getTickets
    })
);

jest.unstable_mockModule(
    "../../src/modules/tickets/timeline/timeline.service.js",
    () => ({
        addEventToTicket,
        buildTicketLogEvent: jest.fn(),
        buildAgentChatEvent: jest.fn(),
        getTicketThread
    })
);

const { default: ticketRoutes } = await import(
    "../../src/modules/tickets/ticket.routes.js"
);

describe("ticket routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns the inbox payload shape for GET /tickets", async () => {
        getTickets.mockResolvedValue({
            tickets: [
                {
                    id: "ticket-db-id",
                    ticketId: "TKT-20260420-ABC123",
                    title: "Wallet issue",
                    description: "Customer wallet is not updating",
                    status: "OPEN",
                    priority: "HIGH",
                    assignedTo: null,
                    createdBy: {
                        userId: "admin-id",
                        name: "Admin User",
                        email: "admin@example.com"
                    },
                    updatedBy: {
                        userId: "admin-id",
                        name: "Admin User",
                        email: "admin@example.com"
                    },
                    createdAt: "2026-04-20T12:00:00.000Z",
                    updatedAt: "2026-04-20T12:00:00.000Z"
                }
            ],
            meta: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            }
        });

        const app = express();
        app.use(express.json());
        app.use(ticketRoutes);
        app.use((error, req, res, next) => {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        });

        const response = await request(app)
            .get("/tickets")
            .query({ status: "OPEN", page: 1, limit: 20 });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            message: "Tickets fetched successfully",
            data: {
                tickets: [
                    {
                        id: "ticket-db-id",
                        ticketId: "TKT-20260420-ABC123",
                        title: "Wallet issue",
                        description: "Customer wallet is not updating",
                        status: "OPEN",
                        priority: "HIGH",
                        assignedTo: null,
                        createdBy: {
                            userId: "admin-id",
                            name: "Admin User",
                            email: "admin@example.com"
                        },
                        updatedBy: {
                            userId: "admin-id",
                            name: "Admin User",
                            email: "admin@example.com"
                        },
                        createdAt: "2026-04-20T12:00:00.000Z",
                        updatedAt: "2026-04-20T12:00:00.000Z"
                    }
                ]
            },
            meta: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            }
        });
    });

    it("returns the unified thread payload shape for GET /tickets/:ticketId/thread", async () => {
        getTicketThread.mockResolvedValue([
            {
                id: "event-id",
                type: "CHAT",
                channel: "CHAT",
                createdAt: "2026-05-05T12:00:00.000Z",
                actor: {
                    type: "AGENT",
                    userId: "admin-id",
                    name: "Admin User",
                    email: "admin@example.com"
                },
                content: "We are on it."
            }
        ]);

        const app = express();
        app.use(express.json());
        app.use(ticketRoutes);
        app.use((error, req, res, next) => {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        });

        const response = await request(app).get("/tickets/TKT-20260420-ABC123/thread");

        expect(response.status).toBe(200);
        expect(getTicketThread).toHaveBeenCalledWith("TKT-20260420-ABC123");
        expect(response.body).toEqual({
            success: true,
            message: "Ticket thread fetched successfully",
            data: {
                thread: [
                    {
                        id: "event-id",
                        type: "CHAT",
                        channel: "CHAT",
                        createdAt: "2026-05-05T12:00:00.000Z",
                        actor: {
                            type: "AGENT",
                            userId: "admin-id",
                            name: "Admin User",
                            email: "admin@example.com"
                        },
                        content: "We are on it."
                    }
                ]
            }
        });
    });

    it("returns the added event payload shape for POST /tickets/:ticketId/events", async () => {
        addEventToTicket.mockResolvedValue({
            id: "event-id",
            type: "EMAIL",
            channel: "EMAIL",
            createdAt: "2026-05-05T12:00:00.000Z",
            actor: {
                type: "AGENT",
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            },
            content: {
                subject: "Reset link reissued",
                body: "We have re-issued the reset link. Please try again.",
                fromEmail: "support@example.com",
                toEmail: "sarah.chen@example.com"
            }
        });

        const app = express();
        app.use(express.json());
        app.use(ticketRoutes);
        app.use((error, req, res, next) => {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        });

        const response = await request(app)
            .post("/tickets/TKT-20260420-ABC123/events")
            .send({
                channel: "EMAIL",
                email: {
                    subject: "Reset link reissued",
                    body: "We have re-issued the reset link. Please try again.",
                    fromEmail: "support@example.com",
                    toEmail: "sarah.chen@example.com"
                }
            });

        expect(response.status).toBe(201);
        expect(addEventToTicket).toHaveBeenCalledWith(
            "TKT-20260420-ABC123",
            {
                channel: "EMAIL",
                email: {
                    subject: "Reset link reissued",
                    body: "We have re-issued the reset link. Please try again.",
                    fromEmail: "support@example.com",
                    toEmail: "sarah.chen@example.com"
                }
            },
            {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            }
        );
        expect(response.body).toEqual({
            success: true,
            message: "Ticket event added successfully",
            data: {
                event: {
                    id: "event-id",
                    type: "EMAIL",
                    channel: "EMAIL",
                    createdAt: "2026-05-05T12:00:00.000Z",
                    actor: {
                        type: "AGENT",
                        userId: "admin-id",
                        name: "Admin User",
                        email: "admin@example.com"
                    },
                    content: {
                        subject: "Reset link reissued",
                        body: "We have re-issued the reset link. Please try again.",
                        fromEmail: "support@example.com",
                        toEmail: "sarah.chen@example.com"
                    }
                }
            }
        });
    });
});
