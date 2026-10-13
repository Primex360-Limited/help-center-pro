import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const userFindFirstMock = jest.fn();
const userFindManyMock = jest.fn();
const userFindUniqueMock = jest.fn();
const userCreateMock = jest.fn();
const userUpdateMock = jest.fn();

const sessionCreateMock = jest.fn();
const sessionFindFirstMock = jest.fn();
const sessionUpdateMock = jest.fn();
const sessionUpdateManyMock = jest.fn();

const roleFindFirstMock = jest.fn();
const roleCreateMock = jest.fn();

const tenantFindUniqueMock = jest.fn();
const tenantFindFirstMock = jest.fn();

const verificationTokenCreateMock = jest.fn();
const verificationTokenFindFirstMock = jest.fn();
const verificationTokenUpdateMock = jest.fn();

const passwordResetTokenCreateMock = jest.fn();
const passwordResetTokenFindFirstMock = jest.fn();
const passwordResetTokenUpdateMock = jest.fn();

const sendVerificationEmailMock = jest.fn();
const sendWelcomeEmailMock = jest.fn();
const sendPasswordResetEmailMock = jest.fn();
const generateRandomTokenMock = jest.fn();
const hashTokenMock = jest.fn();
const comparePasswordMock = jest.fn();
const generateAccessTokenMock = jest.fn();
const generateRefreshTokenMock = jest.fn();
const hashPasswordMock = jest.fn();
const verifyRefreshTokenMock = jest.fn();

const buildUserAccessProfileMock = jest.fn();
const findUserWithRoleMock = jest.fn();
const getEffectivePermissionsFromUserMock = jest.fn();
const isSuperAdminUserMock = jest.fn();
const recordAuditLogMock = jest.fn();
const seedSystemRolesMock = jest.fn();

const prismaMock = {
    user: {
        findFirst: userFindFirstMock,
        findMany: userFindManyMock,
        findUnique: userFindUniqueMock,
        create: userCreateMock,
        update: userUpdateMock
    },
    session: {
        create: sessionCreateMock,
        findFirst: sessionFindFirstMock,
        update: sessionUpdateMock,
        updateMany: sessionUpdateManyMock
    },
    role: {
        findFirst: roleFindFirstMock,
        create: roleCreateMock
    },
    tenant: {
        findUnique: tenantFindUniqueMock,
        findFirst: tenantFindFirstMock
    },
    verificationToken: {
        create: verificationTokenCreateMock,
        findFirst: verificationTokenFindFirstMock,
        update: verificationTokenUpdateMock
    },
    passwordResetToken: {
        create: passwordResetTokenCreateMock,
        findFirst: passwordResetTokenFindFirstMock,
        update: passwordResetTokenUpdateMock
    }
};

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const ROLE_ID = "33333333-3333-4333-8333-333333333333";

const TENANT_USER = {
    id: USER_ID,
    tenantId: TENANT_ID,
    userType: "tenant",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    passwordHash: "hashed-password",
    status: "active",
    emailVerified: true,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    mustChangePassword: false,
    roleId: ROLE_ID,
    role: { id: ROLE_ID, name: "Tenant Admin" }
};

const ALL_MOCKS = [
    userFindFirstMock, userFindManyMock, userFindUniqueMock, userCreateMock,
    userUpdateMock, sessionCreateMock, sessionFindFirstMock, sessionUpdateMock,
    sessionUpdateManyMock, roleFindFirstMock, roleCreateMock,
    tenantFindUniqueMock, tenantFindFirstMock, verificationTokenCreateMock,
    verificationTokenFindFirstMock, verificationTokenUpdateMock,
    passwordResetTokenCreateMock, passwordResetTokenFindFirstMock,
    passwordResetTokenUpdateMock, sendVerificationEmailMock,
    sendWelcomeEmailMock, sendPasswordResetEmailMock, generateRandomTokenMock, hashTokenMock,
    comparePasswordMock, generateAccessTokenMock, generateRefreshTokenMock,
    hashPasswordMock, verifyRefreshTokenMock, buildUserAccessProfileMock,
    findUserWithRoleMock, getEffectivePermissionsFromUserMock,
    isSuperAdminUserMock, recordAuditLogMock, seedSystemRolesMock
];
/**
 * Reset every mock and install the happy-path defaults. `unstable_mockModule`
 * reuses the same `jest.fn()` instances across tests, so leaving
 * implementations behind would leak behaviour between cases.
 */
function resetMockState() {
    ALL_MOCKS.forEach((mock) => mock.mockReset());

    sessionCreateMock.mockResolvedValue({ id: "session-id" });
    sessionUpdateManyMock.mockResolvedValue({ count: 0 });
    sendVerificationEmailMock.mockResolvedValue({});
    sendWelcomeEmailMock.mockResolvedValue({});
    sendPasswordResetEmailMock.mockResolvedValue({});
    generateRandomTokenMock.mockReturnValue("raw-token");
    hashTokenMock.mockReturnValue("hashed-token");
    hashPasswordMock.mockResolvedValue("hashed-password");
    comparePasswordMock.mockResolvedValue(true);
    generateAccessTokenMock.mockReturnValue("access-token");
    generateRefreshTokenMock.mockReturnValue("refresh-token");
    verifyRefreshTokenMock.mockReturnValue({ sub: USER_ID });
    buildUserAccessProfileMock.mockReturnValue({
        role: { id: ROLE_ID, name: "Tenant Admin" },
        roleId: ROLE_ID,
        isProvider: false,
        isSuperAdmin: false,
        allowedPermissions: ["ticket:read"],
        deniedPermissions: []
    });
    getEffectivePermissionsFromUserMock.mockReturnValue(["ticket:read"]);
    isSuperAdminUserMock.mockReturnValue(false);
    recordAuditLogMock.mockResolvedValue(undefined);
    seedSystemRolesMock.mockResolvedValue([]);
}

async function loadAuthService(nodeEnv = "development") {
    jest.resetModules();

    jest.unstable_mockModule("../../src/database/prisma/client.js", () => ({
        default: prismaMock,
        prisma: prismaMock
    }));

    jest.unstable_mockModule("../../src/config/env.js", () => ({
        env: {
            NODE_ENV: nodeEnv
        }
    }));

    jest.unstable_mockModule("../../src/shared/utils/auditLogger.js", () => ({
        recordAuditLog: recordAuditLogMock
    }));

    jest.unstable_mockModule("../../src/modules/auth/auth.email.js", () => ({
        default: sendVerificationEmailMock,
        sendWelcomeEmail: sendWelcomeEmailMock,
        sendPasswordResetEmail: sendPasswordResetEmailMock
    }));

    jest.unstable_mockModule("../../src/modules/auth/auth.utils.js", () => ({
        comparePassword: comparePasswordMock,
        generateAccessToken: generateAccessTokenMock,
        generateRandomToken: generateRandomTokenMock,
        generateRefreshToken: generateRefreshTokenMock,
        hashPassword: hashPasswordMock,
        hashToken: hashTokenMock,
        verifyRefreshToken: verifyRefreshTokenMock
    }));

    jest.unstable_mockModule("../../src/modules/roles/role.service.js", () => ({
        buildUserAccessProfile: buildUserAccessProfileMock,
        findUserWithRole: findUserWithRoleMock,
        getEffectivePermissionsFromUser: getEffectivePermissionsFromUserMock,
        isSuperAdminUser: isSuperAdminUserMock
    }));

    jest.unstable_mockModule("../../src/modules/roles/seedSystemRoles.js", () => ({
        seedSystemRoles: seedSystemRolesMock,
        provisionTenantRoles: jest.fn().mockResolvedValue({}),
        default: seedSystemRolesMock
    }));

    return import("../../src/modules/auth/auth.service.js");
}
describe("loginUser", () => {
    beforeEach(() => {
        resetMockState();
    });

    it("issues a tenant-scoped token pair and records the session", async () => {
        const { loginUser } = await loadAuthService();

        userFindManyMock.mockResolvedValue([TENANT_USER]);
        tenantFindUniqueMock.mockResolvedValue({ id: TENANT_ID, status: "active" });
        findUserWithRoleMock.mockResolvedValue(TENANT_USER);

        const result = await loginUser({
            email: "Admin@Example.com",
            password: "Secret123!",
            deviceInfo: "jest",
            ipAddress: "127.0.0.1"
        });

        expect(userFindManyMock).toHaveBeenCalledWith(
            expect.objectContaining({ where: { email: "admin@example.com" } })
        );
        expect(comparePasswordMock).toHaveBeenCalledWith(
            "Secret123!",
            "hashed-password"
        );
        expect(sessionCreateMock).toHaveBeenCalledWith({
            data: {
                userId: USER_ID,
                tenantId: TENANT_ID,
                deviceInfo: "jest",
                ipAddress: "127.0.0.1",
                refreshTokenHash: "hashed-token",
                expiresAt: expect.any(Date)
            }
        });
        expect(userUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: USER_ID },
                data: expect.objectContaining({ isOnline: true })
            })
        );
        expect(result.accessToken).toBe("access-token");
        expect(result.refreshToken).toBe("refresh-token");
        expect(result.user.passwordHash).toBeUndefined();
        expect(recordAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "LOGIN_SUCCESS",
                tenantId: TENANT_ID
            })
        );
    });

    it("embeds the PRD claim set in the access token", async () => {
        const { loginUser } = await loadAuthService();

        userFindManyMock.mockResolvedValue([TENANT_USER]);
        tenantFindUniqueMock.mockResolvedValue({ id: TENANT_ID, status: "active" });
        findUserWithRoleMock.mockResolvedValue(TENANT_USER);

        await loginUser({ email: "admin@example.com", password: "Secret123!" });

        const [payload] = generateAccessTokenMock.mock.calls[0];

        expect(payload).toEqual({
            sub: USER_ID,
            user_id: USER_ID,
            email: "admin@example.com",
            user_type: "tenant",
            tenant_id: TENANT_ID,
            role_id: ROLE_ID,
            is_super_admin: false,
            permissions: ["ticket:read"]
        });
    });

    it("uses null tenant claims for provider super admins", async () => {
        const { loginUser } = await loadAuthService();

        const providerUser = {
            ...TENANT_USER,
            tenantId: null,
            userType: "provider",
            email: "ops@helpcentrepro.com"
        };

        userFindManyMock.mockResolvedValue([providerUser]);
        isSuperAdminUserMock.mockReturnValue(true);
        findUserWithRoleMock.mockResolvedValue(providerUser);

        await loginUser({
            email: "ops@helpcentrepro.com",
            password: "Secret123!"
        });

        const [payload] = generateAccessTokenMock.mock.calls[0];

        expect(payload.tenant_id).toBeNull();
        expect(payload.user_type).toBe("provider");
        expect(payload.is_super_admin).toBe(true);
        expect(sessionCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ tenantId: null })
            })
        );
        expect(tenantFindUniqueMock).not.toHaveBeenCalled();
    });

    it("rejects a wrong password without creating a session", async () => {
        const { loginUser } = await loadAuthService();

        userFindManyMock.mockResolvedValue([TENANT_USER]);
        tenantFindUniqueMock.mockResolvedValue({ id: TENANT_ID, status: "active" });
        comparePasswordMock.mockResolvedValue(false);

        await expect(
            loginUser({ email: "admin@example.com", password: "wrong" })
        ).rejects.toMatchObject({ statusCode: 401 });

        expect(sessionCreateMock).not.toHaveBeenCalled();
    });

    it("blocks logins into a suspended workspace", async () => {
        const { loginUser } = await loadAuthService();

        userFindManyMock.mockResolvedValue([TENANT_USER]);
        tenantFindUniqueMock.mockResolvedValue({
            id: TENANT_ID,
            status: "suspended"
        });

        await expect(
            loginUser({ email: "admin@example.com", password: "Secret123!" })
        ).rejects.toMatchObject({ statusCode: 403 });

        expect(sessionCreateMock).not.toHaveBeenCalled();
    });

    it("scopes the lookup to the resolved tenant when one is known", async () => {
        const { loginUser } = await loadAuthService();

        userFindFirstMock.mockResolvedValue(TENANT_USER);
        tenantFindUniqueMock.mockResolvedValue({ id: TENANT_ID, status: "active" });
        findUserWithRoleMock.mockResolvedValue(TENANT_USER);

        await loginUser({
            email: "admin@example.com",
            password: "Secret123!",
            tenantId: TENANT_ID
        });

        expect(userFindFirstMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { email: "admin@example.com", tenantId: TENANT_ID }
            })
        );
        expect(userFindManyMock).not.toHaveBeenCalled();
    });

    it("reports an ambiguous email across workspaces", async () => {
        const { loginUser } = await loadAuthService();

        userFindManyMock.mockResolvedValue([
            TENANT_USER,
            { ...TENANT_USER, id: ROLE_ID }
        ]);

        await expect(
            loginUser({ email: "admin@example.com", password: "Secret123!" })
        ).rejects.toMatchObject({ statusCode: 409 });
    });
});
describe("registerSuperAdmin", () => {
    beforeEach(() => {
        resetMockState();
    });

    const providerUser = {
        ...TENANT_USER,
        tenantId: null,
        userType: "provider",
        email: "ops@helpcentrepro.com",
        firstName: "Ops"
    };
    const roleId = "44444444-4444-4444-8444-444444444444";

    it("creates the provider super admin and reports the email contract", async () => {
        const { registerSuperAdmin } = await loadAuthService();

        roleFindFirstMock.mockResolvedValue({
            id: roleId,
            name: "Provider Super Admin"
        });
        userFindFirstMock.mockResolvedValue(null);
        userCreateMock.mockResolvedValue(providerUser);
        findUserWithRoleMock.mockResolvedValue(providerUser);

        const result = await registerSuperAdmin({
            email: "Ops@HelpCentrePro.com",
            password: "Secret123!",
            firstName: "Ops",
            lastName: "Admin"
        });

        expect(seedSystemRolesMock).toHaveBeenCalledTimes(1);
        expect(userCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    tenantId: null,
                    userType: "provider",
                    email: "ops@helpcentrepro.com",
                    passwordHash: "hashed-password",
                    roleId,
                    emailVerified: true,
                    emailVerifiedAt: expect.any(Date),
                    mustChangePassword: false,
                    deniedPermissions: []
                })
            })
        );
        expect(verificationTokenCreateMock).not.toHaveBeenCalled();
        expect(sendVerificationEmailMock).not.toHaveBeenCalled();
        expect(sendWelcomeEmailMock).toHaveBeenCalledWith({
            to: "ops@helpcentrepro.com",
            firstName: "Ops"
        });
        expect(result.emailSent).toBe(true);
        expect(result.verificationToken).toBeUndefined();
        expect(recordAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({ action: "USER_REGISTERED" })
        );
        expect(recordAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({ action: "ROLE_ASSIGNED" })
        );
    });

    it("still creates the account when sending email fails in development", async () => {
        const { registerSuperAdmin } = await loadAuthService("development");

        roleFindFirstMock.mockResolvedValue({
            id: roleId,
            name: "Provider Super Admin"
        });
        userFindFirstMock.mockResolvedValue(null);
        userCreateMock.mockResolvedValue(providerUser);
        findUserWithRoleMock.mockResolvedValue(providerUser);
        sendWelcomeEmailMock.mockRejectedValue(new Error("resend is down"));

        const result = await registerSuperAdmin({
            email: "ops@helpcentrepro.com",
            password: "Secret123!",
            firstName: "Ops",
            lastName: "Admin"
        });

        expect(result.emailSent).toBe(false);
        expect(result.user).toBeDefined();
    });

    it("rejects an email already used by another provider account", async () => {
        const { registerSuperAdmin } = await loadAuthService();

        roleFindFirstMock.mockResolvedValue({
            id: roleId,
            name: "Provider Super Admin"
        });
        userFindFirstMock.mockResolvedValue({ id: USER_ID });

        await expect(
            registerSuperAdmin({
                email: "ops@helpcentrepro.com",
                password: "Secret123!",
                firstName: "Ops",
                lastName: "Admin"
            })
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(userCreateMock).not.toHaveBeenCalled();
    });

    it("rejects bootstrap when a platform admin already exists", async () => {
        const { registerSuperAdmin } = await loadAuthService();

        roleFindFirstMock.mockResolvedValue({
            id: roleId,
            name: "Provider Super Admin"
        });
        userFindFirstMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: USER_ID });

        await expect(
            registerSuperAdmin({
                email: "new@helpcentrepro.com",
                password: "Secret123!",
                firstName: "New",
                lastName: "Admin"
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            message: expect.stringMatching(/Admin Portal/i)
        });

        expect(userCreateMock).not.toHaveBeenCalled();
    });
});
describe("requestPasswordReset", () => {
    beforeEach(() => {
        resetMockState();
    });

    it("returns emailSent and a dev reset token for an existing user", async () => {
        const { requestPasswordReset } = await loadAuthService("development");

        userFindFirstMock.mockResolvedValue(TENANT_USER);
        generateRandomTokenMock.mockReturnValue("raw-reset-token");
        hashTokenMock.mockReturnValue("hashed-reset-token");

        const result = await requestPasswordReset({
            email: "Admin@Example.com"
        });

        expect(userFindFirstMock).toHaveBeenCalledWith({
            where: { email: "admin@example.com", tenantId: null }
        });
        expect(passwordResetTokenCreateMock).toHaveBeenCalledWith({
            data: {
                userId: USER_ID,
                tokenHash: "hashed-reset-token",
                expiresAt: expect.any(Date)
            }
        });
        expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
            to: "admin@example.com",
            firstName: "Admin",
            token: "raw-reset-token"
        });
        expect(result).toEqual({
            emailSent: true,
            resetToken: "raw-reset-token"
        });
    });

    it("uses the workspace row when a tenant is known", async () => {
        const { requestPasswordReset } = await loadAuthService("production");

        userFindFirstMock.mockResolvedValue(TENANT_USER);

        const result = await requestPasswordReset({
            email: "admin@example.com",
            tenantId: TENANT_ID
        });

        expect(userFindFirstMock).toHaveBeenCalledWith({
            where: { email: "admin@example.com", tenantId: TENANT_ID }
        });
        expect(result).toEqual({ emailSent: true });
        expect(result.resetToken).toBeUndefined();
    });

    it("does not leak whether the account exists", async () => {
        const { requestPasswordReset } = await loadAuthService("production");

        userFindFirstMock.mockResolvedValue(null);

        const result = await requestPasswordReset({
            email: "missing@example.com"
        });

        expect(passwordResetTokenCreateMock).not.toHaveBeenCalled();
        expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
        expect(result).toEqual({ emailSent: true });
    });
});
describe("resendVerificationEmail", () => {
    beforeEach(() => {
        resetMockState();
    });

    it("re-sends the verification email for an unverified user", async () => {
        const { resendVerificationEmail } = await loadAuthService("development");

        userFindFirstMock.mockResolvedValue({
            ...TENANT_USER,
            emailVerified: false
        });

        const result = await resendVerificationEmail({
            email: "admin@example.com"
        });

        expect(verificationTokenCreateMock).toHaveBeenCalledWith({
            data: {
                userId: USER_ID,
                tokenHash: "hashed-token",
                expiresAt: expect.any(Date)
            }
        });
        expect(sendVerificationEmailMock).toHaveBeenCalledWith({
            to: "admin@example.com",
            firstName: "Admin",
            token: "raw-token"
        });
        expect(result.emailSent).toBe(true);
        expect(result.verificationToken).toBe("raw-token");
    });

    it("stays silent for verified or unknown emails", async () => {
        const { resendVerificationEmail } = await loadAuthService("production");

        userFindFirstMock.mockResolvedValue(TENANT_USER);

        const verifiedResult = await resendVerificationEmail({
            email: "admin@example.com"
        });

        userFindFirstMock.mockResolvedValue(null);

        const unknownResult = await resendVerificationEmail({
            email: "missing@example.com"
        });

        expect(verificationTokenCreateMock).not.toHaveBeenCalled();
        expect(sendVerificationEmailMock).not.toHaveBeenCalled();
        expect(verifiedResult).toEqual({ emailSent: true });
        expect(unknownResult).toEqual({ emailSent: true });
    });
});

describe("verifyEmailToken", () => {
    beforeEach(() => {
        resetMockState();
    });

    it("verifies the email and issues a password setup token for invitees", async () => {
        const { verifyEmailToken } = await loadAuthService("development");

        verificationTokenFindFirstMock.mockResolvedValue({
            id: "55555555-5555-4555-8555-555555555555",
            userId: USER_ID,
            expiresAt: new Date(Date.now() + 60_000)
        });
        userFindUniqueMock.mockResolvedValue({
            ...TENANT_USER,
            emailVerified: false,
            emailVerifiedAt: null,
            mustChangePassword: true
        });
        generateRandomTokenMock.mockReturnValue("raw-setup-token");
        hashTokenMock
            .mockReturnValueOnce("hashed-token")
            .mockReturnValueOnce("hashed-setup-token");

        const result = await verifyEmailToken({ token: "raw-token" });

        expect(verificationTokenFindFirstMock).toHaveBeenCalledWith({
            where: { tokenHash: "hashed-token", usedAt: null }
        });
        expect(userUpdateMock).toHaveBeenCalledWith({
            where: { id: USER_ID },
            data: expect.objectContaining({ emailVerified: true })
        });
        expect(passwordResetTokenCreateMock).toHaveBeenCalledWith({
            data: {
                userId: USER_ID,
                tokenHash: "hashed-setup-token",
                expiresAt: expect.any(Date)
            }
        });
        expect(result).toMatchObject({
            emailVerified: true,
            requiresPasswordSetup: true,
            passwordSetupToken: "raw-setup-token"
        });
    });

    it("rejects an unknown verification token", async () => {
        const { verifyEmailToken } = await loadAuthService("development");

        verificationTokenFindFirstMock.mockResolvedValue(null);

        await expect(verifyEmailToken({ token: "nope" })).rejects.toMatchObject({
            statusCode: 400
        });
        expect(userUpdateMock).not.toHaveBeenCalled();
    });
});
describe("resetPassword", () => {
    beforeEach(() => {
        resetMockState();
    });

    it("stores the new hash, clears the flag and revokes live sessions", async () => {
        const { resetPassword } = await loadAuthService();

        passwordResetTokenFindFirstMock.mockResolvedValue({
            id: "66666666-6666-4666-8666-666666666666",
            userId: USER_ID,
            expiresAt: new Date(Date.now() + 60_000)
        });
        userFindUniqueMock.mockResolvedValue(TENANT_USER);
        hashPasswordMock.mockResolvedValue("new-hashed-password");

        const result = await resetPassword({
            token: "raw-reset-token",
            password: "Secret456!",
            confirmPassword: "Secret456!"
        });

        expect(userUpdateMock).toHaveBeenCalledWith({
            where: { id: USER_ID },
            data: expect.objectContaining({
                passwordHash: "new-hashed-password",
                mustChangePassword: false,
                emailVerified: true
            })
        });
        expect(passwordResetTokenUpdateMock).toHaveBeenCalledWith({
            where: { id: "66666666-6666-4666-8666-666666666666" },
            data: { usedAt: expect.any(Date) }
        });
        expect(sessionUpdateManyMock).toHaveBeenCalledWith({
            where: { userId: USER_ID, isRevoked: false },
            data: { isRevoked: true }
        });
        expect(result).toBe(true);
    });

    it("rejects mismatched passwords before touching the database", async () => {
        const { resetPassword } = await loadAuthService();

        await expect(
            resetPassword({
                token: "raw-reset-token",
                password: "Secret456!",
                confirmPassword: "Different456!"
            })
        ).rejects.toMatchObject({ statusCode: 400 });

        expect(passwordResetTokenFindFirstMock).not.toHaveBeenCalled();
    });

    it("rejects an expired reset token", async () => {
        const { resetPassword } = await loadAuthService();

        passwordResetTokenFindFirstMock.mockResolvedValue({
            id: "66666666-6666-4666-8666-666666666666",
            userId: USER_ID,
            expiresAt: new Date(Date.now() - 60_000)
        });

        await expect(
            resetPassword({
                token: "raw-reset-token",
                password: "Secret456!",
                confirmPassword: "Secret456!"
            })
        ).rejects.toMatchObject({ statusCode: 400 });

        expect(userUpdateMock).not.toHaveBeenCalled();
    });
});

describe("refresh and logout", () => {
    beforeEach(() => {
        resetMockState();
    });

    const sessionId = "77777777-7777-4777-8777-777777777777";

    function primeActiveSession() {
        sessionFindFirstMock.mockResolvedValue({
            id: sessionId,
            userId: USER_ID,
            tenantId: TENANT_ID,
            expiresAt: new Date(Date.now() + 60_000)
        });
        findUserWithRoleMock.mockResolvedValue(TENANT_USER);
        tenantFindUniqueMock.mockResolvedValue({
            id: TENANT_ID,
            status: "active"
        });
    }

    it("rotates the refresh token for a valid session", async () => {
        const { refreshUserToken } = await loadAuthService();

        primeActiveSession();

        const result = await refreshUserToken({ refreshToken: "refresh-token" });

        expect(sessionFindFirstMock).toHaveBeenCalledWith({
            where: {
                userId: USER_ID,
                refreshTokenHash: "hashed-token",
                isRevoked: false
            }
        });
        expect(sessionUpdateMock).toHaveBeenCalledWith({
            where: { id: sessionId },
            data: {
                refreshTokenHash: "hashed-token",
                expiresAt: expect.any(Date)
            }
        });
        expect(result).toEqual({
            accessToken: "access-token",
            refreshToken: "refresh-token"
        });
    });

    it("refuses to rotate tokens for a suspended workspace", async () => {
        const { refreshUserToken } = await loadAuthService();

        primeActiveSession();
        tenantFindUniqueMock.mockResolvedValue({
            id: TENANT_ID,
            status: "suspended"
        });

        await expect(
            refreshUserToken({ refreshToken: "refresh-token" })
        ).rejects.toMatchObject({ statusCode: 403 });

        expect(sessionUpdateMock).not.toHaveBeenCalled();
    });

    it("revokes the session on logout", async () => {
        const { logoutUser } = await loadAuthService();

        primeActiveSession();

        const result = await logoutUser({ refreshToken: "refresh-token" });

        expect(sessionUpdateMock).toHaveBeenCalledWith({
            where: { id: sessionId },
            data: { isRevoked: true }
        });
        expect(userUpdateMock).toHaveBeenCalledWith({
            where: { id: USER_ID },
            data: expect.objectContaining({ isOnline: false })
        });
        expect(result).toBe(true);
    });
});






