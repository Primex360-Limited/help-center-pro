import { mapTicketResponse } from "../helpers/map-ticket-response.js";

export function toCreateTicketDto(ticket){
    return mapTicketResponse(ticket);
}

export default toCreateTicketDto;