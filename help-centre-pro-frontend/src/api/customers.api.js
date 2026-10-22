import { apiRequest } from "./client.js";

/** Customers derived from real ticket history — counts are always accurate. */
export async function listCustomers() {
  return apiRequest("/customers", { auth: true });
}

export async function getCustomerProfile(customerKey) {
  return apiRequest(`/customers/${encodeURIComponent(customerKey)}`, {
    auth: true,
  });
}
