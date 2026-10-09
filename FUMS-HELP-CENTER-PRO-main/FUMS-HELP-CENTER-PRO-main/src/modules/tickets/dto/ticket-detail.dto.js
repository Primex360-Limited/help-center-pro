import { MESSAGE_TYPE } from "../ticket.constants.js";
import { mapTicketResponse, mapTicketMessageResponse } from "../helpers/map-ticket-response.js";

export function toTicketDetailDto(ticket) {
    return {
        ...mapTicketResponse(ticket),
        messages: (ticket.messages || [])
            .filter(message => message.messageType !== MESSAGE_TYPE.INTERNAL_NOTE)
            .map(mapTicketMessageResponse)
    }
}

export default toTicketDetailDto;
