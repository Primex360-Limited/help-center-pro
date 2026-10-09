import { TICKET_STATUS } from "../ticket.constants.js";

export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
    [TICKET_STATUS.QUEUED]: [
        TICKET_STATUS.OPEN,
        TICKET_STATUS.CLOSED
    ],
    [TICKET_STATUS.OPEN]: [
        TICKET_STATUS.PENDING,
        TICKET_STATUS.WAITING_FOR_REPLY,
        TICKET_STATUS.RESOLVED,
        TICKET_STATUS.CLOSED
    ],
    [TICKET_STATUS.PENDING]: [
        TICKET_STATUS.OPEN,
        TICKET_STATUS.WAITING_FOR_REPLY,
        TICKET_STATUS.RESOLVED,
        TICKET_STATUS.CLOSED
    ],
    [TICKET_STATUS.WAITING_FOR_REPLY]: [
        TICKET_STATUS.OPEN,
        TICKET_STATUS.PENDING,
        TICKET_STATUS.RESOLVED,
        TICKET_STATUS.CLOSED
    ],
    [TICKET_STATUS.RESOLVED]: [
        TICKET_STATUS.OPEN,
        TICKET_STATUS.CLOSED
    ],
    [TICKET_STATUS.CLOSED]: []
});

export function isValidStatusTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
        return false;
    }

    return (ALLOWED_STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

export default ALLOWED_STATUS_TRANSITIONS;
