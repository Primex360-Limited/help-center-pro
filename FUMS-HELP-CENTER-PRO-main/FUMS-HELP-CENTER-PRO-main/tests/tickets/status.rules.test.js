import { describe, expect, it } from "@jest/globals";
import { TICKET_STATUS } from "../../src/modules/tickets/ticket.constants.js";
import {
    ALLOWED_STATUS_TRANSITIONS,
    isValidStatusTransition
} from "../../src/modules/tickets/status/status.rules.js";

describe("ticket status transition rules", () => {
    it("matches the allowed transition matrix", () => {
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.QUEUED]).toEqual([
            TICKET_STATUS.OPEN,
            TICKET_STATUS.CLOSED
        ]);
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.OPEN]).toEqual([
            TICKET_STATUS.PENDING,
            TICKET_STATUS.WAITING_FOR_REPLY,
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED
        ]);
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.PENDING]).toEqual([
            TICKET_STATUS.OPEN,
            TICKET_STATUS.WAITING_FOR_REPLY,
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED
        ]);
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.WAITING_FOR_REPLY]).toEqual([
            TICKET_STATUS.OPEN,
            TICKET_STATUS.PENDING,
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED
        ]);
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.RESOLVED]).toEqual([
            TICKET_STATUS.OPEN,
            TICKET_STATUS.CLOSED
        ]);
        expect(ALLOWED_STATUS_TRANSITIONS[TICKET_STATUS.CLOSED]).toEqual([]);
    });

    it("allows only the supported transitions", () => {
        expect(
            isValidStatusTransition(TICKET_STATUS.OPEN, TICKET_STATUS.PENDING)
        ).toBe(true);
        expect(
            isValidStatusTransition(TICKET_STATUS.PENDING, TICKET_STATUS.OPEN)
        ).toBe(true);
        expect(
            isValidStatusTransition(TICKET_STATUS.OPEN, TICKET_STATUS.WAITING_FOR_REPLY)
        ).toBe(true);
        expect(
            isValidStatusTransition(TICKET_STATUS.WAITING_FOR_REPLY, TICKET_STATUS.OPEN)
        ).toBe(true);
        expect(
            isValidStatusTransition(TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED)
        ).toBe(true);

        expect(
            isValidStatusTransition(TICKET_STATUS.CLOSED, TICKET_STATUS.OPEN)
        ).toBe(false);
        expect(
            isValidStatusTransition(TICKET_STATUS.OPEN, TICKET_STATUS.OPEN)
        ).toBe(false);
        expect(
            isValidStatusTransition(TICKET_STATUS.PENDING, TICKET_STATUS.PENDING)
        ).toBe(false);
    });
});
