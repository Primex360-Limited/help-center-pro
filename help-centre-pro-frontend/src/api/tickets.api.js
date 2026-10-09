import { apiRequest } from "./client.js";

export async function getDashboardOverview() {
  return apiRequest("/tickets/dashboard", {
    method: "GET",
    auth: true,
  });
}
