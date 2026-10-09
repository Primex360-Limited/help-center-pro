import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const findTicketByPublicId = jest.fn();
const pickQueuedTicketWithHistory = jest.fn();
const updateTicketAssignmentWithHistory = jest.fn();
const getUserById = jest.fn();
const getUsers = jest.fn();
const mapTicketResponse = jest.fn((ticket) => ({
    ticketId: ticket.ticketId,
    assignedTo: ticket.assignedToUserId
}));

jest.unstable_mockModule(
    "../../src/modules/tickets/ticket.repository.js",
    () => ({
        findTicketByPublicId,
        pickQueuedTicketWithHistory,
        updateTicketAssignmentWithHistory
    })
);

jest.unstable_mockModule("../../src/modules/users/user.service.js", () => ({
    getUserById,
    getUsers
}));

jest.unstable_mockModule(
    "../../src/modules/tickets/timeline/timeline.service.js",
    () => ({
        buildTicketLogEvent: jest.fn(({ action, content }) => ({
            type: "LOG",
            channel: "CHAT",
            createdBy: "AGENT",
            metadata: { action, content }
        }))
    })
);

jest.unstable_mockModule(
    "../../src/modules/tickets/helpers/map-ticket-response.js",
    () => ({
        mapTicketResponse
    })
);

const { USER_STATUS } = await import(
    "../../src/shared/constants/system.js"
);
const { assignTicket } = await import(
    "../../src/modules/tickets/assignments/assignment.service.js"
);

describe("assignTicket", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects inactive assignees", async () => {
        findTicketByPublicId.mockResolvedValue({
            id: "ticket-db-id",
            ticketId: "TKT-20260420-ABC123",
            assignedToUserId: null
        });
        getUserById.mockResolvedValue({
            _id: "agent-id",
            firstName: "Inactive",
            lastName: "Agent",
            email: "inactive@example.com",
            status: USER_STATUS.SUSPENDED
        });

        await expect(
            assignTicket("TKT-20260420-ABC123", "agent-id", {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            })
        ).rejects.toMatchObject({
            message: "Only active users can be assigned to tickets",
            statusCode: 400
        });
    });

    it("stores the assigned user snapshot and assignment history", async () => {
        findTicketByPublicId.mockResolvedValue({
            id: "ticket-db-id",
            ticketId: "TKT-20260420-ABC123",
            assignedToUserId: null,
            assignedToName: null,
            assignedToEmail: null
        });

        getUserById.mockResolvedValue({
            _id: "agent-id",
            firstName: "Assigned",
            lastName: "Agent",
            email: "agent@example.com",
            status: USER_STATUS.ACTIVE,
            allowedPermissions: ["ticket.receive_assignment"]
        });

        updateTicketAssignmentWithHistory.mockResolvedValue({
            ticketId: "TKT-20260420-ABC123",
            assignedToUserId: "agent-id"
        });

        const result = await assignTicket(
            "TKT-20260420-ABC123",
            "agent-id",
            {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            }
        );

        expect(updateTicketAssignmentWithHistory).toHaveBeenCalledWith({
            ticketRefId: "ticket-db-id",
            assignment: {
                userId: "agent-id",
                name: "Assigned Agent",
                email: "agent@example.com"
            },
            updatedBy: {
                userId: "admin-id",
                name: "Admin User",
                email: "admin@example.com"
            },
            history: {
                previousAssignedToUserId: null,
                previousAssignedToName: null,
                previousAssignedToEmail: null,
                newAssignedToUserId: "agent-id",
                newAssignedToName: "Assigned Agent",
                newAssignedToEmail: "agent@example.com",
                assignedByUserId: "admin-id",
                assignedByName: "Admin User",
                assignedByEmail: "admin@example.com",
                transferReason: undefined
            }
        });
        expect(result).toEqual({
            ticketId: "TKT-20260420-ABC123",
            assignedTo: "agent-id"
        });
    });
});
