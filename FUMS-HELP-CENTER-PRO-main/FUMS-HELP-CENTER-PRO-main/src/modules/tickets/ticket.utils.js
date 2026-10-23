import { AppError } from "../../shared/errors/AppError.js";
import {
    DEFAULT_TICKET_LIMIT,
    DEFAULT_TICKET_PAGE,
    MAX_TICKET_LIMIT
} from "./ticket.constants.js";

export function buildActorSnapshotFromRequest(req) {
    if (!req.currentUser) {
        throw new AppError("Authenticated user information is missing", 401);
    }

    const userId = req.currentUser.id || req.user?.sub;
    const name = [req.currentUser.firstName, req.currentUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || req.currentUser.email;

    return {
        userId,
        name,
        email: req.currentUser.email,
        tenantId: req.tenantId ?? req.currentUser.tenantId ?? req.user?.tenant_id ?? null
    };
}

export function buildUserSnapshot(user) {
    if (!user) {
        throw new AppError("User snapshot source is required", 500);
    }

    return {
        userId: user.id || user.userId || null,
        name: [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || user.name || user.email,
        email: user.email,
        tenantId: user.tenantId ?? user.tenant_id ?? null
    };
}

export function getClientIpFromRequest(req) {
    const forwardedFor = req.headers?.["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor?.split(",")[0];

    return (
        forwardedIp ||
        req.headers?.["x-real-ip"] ||
        req.ip ||
        req.socket?.remoteAddress ||
        null
    )?.replace(/^::ffff:/, "").trim() || null;
}

export function getPagination(query = {}) {
    const page = Math.max(
        DEFAULT_TICKET_PAGE,
        Number.parseInt(query.page, 10) || DEFAULT_TICKET_PAGE
    );
    const limit = Math.min(
        MAX_TICKET_LIMIT,
        Math.max(
            DEFAULT_TICKET_LIMIT,
            Number.parseInt(query.limit, 10) || DEFAULT_TICKET_LIMIT
        )
    );
    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
}

export function buildPaginationMeta({ page, limit, total }) {
    const totalPages = Math.ceil(total / limit);
    return {
        page,
        limit,
        total,
        totalPages
    };
}
