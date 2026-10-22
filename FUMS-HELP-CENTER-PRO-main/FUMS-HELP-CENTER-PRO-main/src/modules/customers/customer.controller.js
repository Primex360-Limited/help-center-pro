import successResponse from "../../shared/utils/apiResponse.js";
import { getCustomerProfile, listCustomers } from "./customer.service.js";

export async function listCustomersHandler(req, res) {
    const result = await listCustomers();
    return successResponse(res, "Customers fetched successfully", result);
}

export async function getCustomerProfileHandler(req, res) {
    const result = await getCustomerProfile(req.params.customerKey);
    return successResponse(res, "Customer profile fetched successfully", result);
}
