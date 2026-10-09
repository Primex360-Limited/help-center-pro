import { describe, expect, it, jest } from "@jest/globals";
import { USER_STATUS, SYSTEM_ROLE } from "../../src/shared/constants/system.js";
import { requirePermission } from "../../src/modules/roles/rbac.middleware.js";

async function runMiddleware(req, permission = "ticket.view") {
    const middleware = requirePermission(permission);
    const next = jest.fn();

    await middleware(req, {}, next);

    return next;
}

describe("requirePermission", () => {
    it("allows active Super Admin users without explicit permission", async () => {
        const next = await runMiddleware({
            user: { sub: "super-admin-id" },
            currentUser: {
                status: USER_STATUS.ACTIVE,
                roleId: {
                    name: SYSTEM_ROLE.SUPER_ADMIN,
                    permissions: []
                },
                deniedPermissions: ["ticket.view"]
            }
        });

        expect(next).toHaveBeenCalledWith();
    });

    it("still blocks non-super-admin users without the required permission", async () => {
        const next = await runMiddleware({
            user: { sub: "agent-id" },
            currentUser: {
                status: USER_STATUS.ACTIVE,
                roleId: {
                    name: "Support Agent",
                    permissions: ["ticket.message"]
                },
                deniedPermissions: []
            }
        });

        expect(next.mock.calls[0][0]).toMatchObject({
            message: "Forbidden: insufficient permissions",
            statusCode: 403
        });
    });

    it("does not bypass inactive Super Admin accounts", async () => {
        const next = await runMiddleware({
            user: { sub: "super-admin-id" },
            currentUser: {
                status: USER_STATUS.SUSPENDED,
                roleId: {
                    name: SYSTEM_ROLE.SUPER_ADMIN,
                    permissions: []
                },
                deniedPermissions: []
            }
        });

        expect(next.mock.calls[0][0]).toMatchObject({
            message: "User account is not active",
            statusCode: 403
        });
    });
});
