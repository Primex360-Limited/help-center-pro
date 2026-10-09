# Ticket Realtime Events

Socket.IO is mounted on the same HTTP server as the Express app.

## Connection

Agents should connect with an access token:

```js
io(API_BASE_URL, {
  auth: { token: accessToken },
  withCredentials: true
});
```

Customers can connect without a token from the chat widget.

## Customer Events

- `customer:start_chat`
  - Creates a new queued chat ticket and joins the customer to the ticket room.
  - Payload: `{ message, customerName?, customerEmail?, customerPhone?, title?, priority? }`

- `customer:join_ticket`
  - Rejoins an existing ticket room.
  - Payload: `{ ticketId, customerEmail? }`

- `customer:send_message`
  - Appends a customer chat event to the existing ticket thread.
  - Payload: `{ ticketId, message, customerEmail? }`

## Agent Events

- `agent:join_queue`
  - Joins the queue notification room.

- `agent:join_ticket`
  - Joins a ticket room.
  - Requires `ticket.view`.
  - Payload: `{ ticketId }`

- `agent:send_message`
  - Appends an agent chat event to the ticket thread.
  - Requires `ticket.message`.
  - Payload: `{ ticketId, message }`

- `agent:pick_from_queue`
  - Picks a queued ticket and assigns it to the connected agent.
  - Requires `ticket.pick_queue`.
  - Payload: `{ ticketId }`

## Supervisor Events

- `supervisor:join_ticket`
  - Silently joins a ticket room for monitoring.
  - Requires `ticket.supervise`.
  - Payload: `{ ticketId }`

## Broadcast Events

- `ticket:created`
- `ticket:queued`
- `ticket:event`
- `ticket:email_received`
- `ticket:picked`
- `ticket:customer_message`
- `ticket:typing`
- `agent:online`
- `agent:offline`
- `socket:error`

## Email Realtime Updates

When Resend receives a customer email, the backend stores it in the ticket timeline and broadcasts:

- `ticket:email_received`
  - Sent to online agents.
  - Payload: `{ ticket, event, created, source: "EMAIL" }`

- `ticket:event`
  - Sent to users currently inside the ticket room.
  - Payload: `{ ticketId, event, source: "EMAIL" }`

When an agent replies by email, the backend sends the email through Resend, stores it in the ticket timeline, and broadcasts:

- `ticket:event`
  - Payload: `{ ticketId, event, source: "EMAIL", direction: "OUTBOUND" }`
