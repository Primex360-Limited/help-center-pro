import { mapTicketResponse } from "../helpers/map-ticket-response.js";

export function toListTicketsDto(tickets = []){
    return tickets.map(mapTicketResponse);
}

export default toListTicketsDto;