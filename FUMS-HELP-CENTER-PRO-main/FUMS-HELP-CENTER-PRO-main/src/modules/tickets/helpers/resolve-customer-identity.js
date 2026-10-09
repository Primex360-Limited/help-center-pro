import { findExistingTicketCustomer } from "../ticket.repository.js";

function normalizeEmail(email) {
    return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone) {
    return phone?.trim() || null;
}

function normalizeIp(ip) {
    return ip?.trim() || null;
}

export async function resolveCustomerIdentity({
    customerEmail,
    customerPhone,
    customerName,
    customerIp
} = {}) {
    const normalizedEmail = normalizeEmail(customerEmail);
    const normalizedPhone = normalizePhone(customerPhone);
    const normalizedName = customerName?.trim() || null;
    const normalizedIp = normalizeIp(customerIp);

    const existingCustomer = await findExistingTicketCustomer({
        customerEmail: normalizedEmail,
        customerPhone: normalizedPhone,
        customerIp: normalizedIp
    });

    if (existingCustomer?.customerId) {
        return {
            customerId: existingCustomer.customerId,
            customerEmail: normalizedEmail || existingCustomer.customerEmail || undefined,
            customerPhone: normalizedPhone || existingCustomer.customerPhone || undefined,
            customerName: normalizedName || existingCustomer.customerName || undefined,
            customerIp: normalizedIp || existingCustomer.customerIp || undefined
        };
    }

    const customerId = normalizedPhone || normalizedEmail || normalizedIp || null;

    return {
        ...(customerId ? { customerId } : {}),
        ...(normalizedEmail ? { customerEmail: normalizedEmail } : {}),
        ...(normalizedPhone ? { customerPhone: normalizedPhone } : {}),
        ...(normalizedName ? { customerName: normalizedName } : {}),
        ...(normalizedIp ? { customerIp: normalizedIp } : {})
    };
}

export default resolveCustomerIdentity;
