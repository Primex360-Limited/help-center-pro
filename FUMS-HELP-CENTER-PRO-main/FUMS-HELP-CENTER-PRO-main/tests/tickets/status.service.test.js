import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const findTicketByPublicId = jest.fn();
const updateTicketStatusWithHistory = jest.fn();
const mapTicketResponse = jest.fn((ticket) => ({
    ticketId: ticket.ticketId,
    status: ticket.status
}));

jest.unstable_mockModule(
    "../../src/modules/tickets/ticket.repository.js",
    () => ({
        findTicketByPublicId,
        updateTicketStatusWithHistory
    })
);

jest.unstable_mockModule(
    "../../src/modules/tickets/helpers/map-ticket-response.js",
    () => ({
        mapTicketResponse
    })
);

const { AppError } = await import("../../src/shared/errors/AppError.js");
const { TICKET_STATUS } = await import(
    "../../src/modules/tickets/ticket.constants.js"
);
const { updateTicketStatus } = await import(
    "../../src/modules/tickets/status/status.service.js"
);

describe("updateTicketStatus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects invalid transitions", async () => {
        findTicketByPublicId.mockResolvedValue({
            id: "ticket-db-id",
            ticketId: "TKT-20260420-ABC123",
            status: TICKET_STATUS.CLOSED
        });

        await expect(
            updateTicketStatus("TKT-20260420-ABC123", TICKET_STATUS.OPEN, {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            })
        ).rejects.toMatchObject({
            message: `Invalid ticket status transition from CLOSED to OPEN`,
            statusCode: 400
        });

        expect(updateTicketStatusWithHistory).not.toHaveBeenCalled();
    });

    it("creates a status history entry for valid transitions", async () => {
        findTicketByPublicId.mockResolvedValue({
            id: "ticket-db-id",
            ticketId: "TKT-20260420-ABC123",
            status: TICKET_STATUS.OPEN
        });

        updateTicketStatusWithHistory.mockResolvedValue({
            id: "ticket-db-id",
            ticketId: "TKT-20260420-ABC123",
            status: TICKET_STATUS.PENDING
        });

        const result = await updateTicketStatus(
            "TKT-20260420-ABC123",
            TICKET_STATUS.PENDING,
            {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            }
        );

        expect(updateTicketStatusWithHistory).toHaveBeenCalledWith({
            ticketRefId: "ticket-db-id",
            status: TICKET_STATUS.PENDING,
            updatedBy: {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            },
            ticketWorkflowData: {
                waitingForCustomerAt: null
            },
            history: {
                oldStatus: TICKET_STATUS.OPEN,
                newStatus: TICKET_STATUS.PENDING,
                changedByUserId: "admin-id",
                changedByName: "Admin User",
                changedByEmail: "admin@example.com"
            }
        });
        expect(result).toEqual({
            ticketId: "TKT-20260420-ABC123",
            status: TICKET_STATUS.PENDING
        });
    });
});
