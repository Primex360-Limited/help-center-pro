import { describe, expect, it } from "@jest/globals";
import {
    buildActorSnapshotFromRequest,
    buildPaginationMeta,
    getPagination
} from "../../src/modules/tickets/ticket.utils.js";
import { AppError } from "../../src/shared/errors/AppError.js";

describe("ticket utils", () => {
    it("builds an actor snapshot from the authenticated request context", () => {
        const actor = buildActorSnapshotFromRequest({
            user: { sub: "mongo-user-id" },
            currentUser: {
                _id: "mongo-user-id",
                firstName: "Caroline",
                lastName: "Susan",
                email: "caroline@example.com"
            }
        });

        expect(actor).toEqual({
            userId: "mongo-user-id",
            name: "Caroline Susan",
            email: "caroline@example.com"
        });
    });

    it("throws when the authenticated user context is missing", () => {
        expect(() => buildActorSnapshotFromRequest({})).toThrow(AppError);
    });

    it("applies default and bounded pagination values", () => {
        expect(getPagination({})).toEqual({
            page: 1,
            limit: 20,
            skip: 0
        });

        expect(getPagination({ page: "3", limit: "150" })).toEqual({
            page: 3,
            limit: 100,
            skip: 200
        });
    });

    it("builds pagination metadata", () => {
        expect(
            buildPaginationMeta({
                page: 2,
                limit: 20,
                total: 55
            })
        ).toEqual({
            page: 2,
            limit: 20,
            total: 55,
            totalPages: 3
        });
    });
});
