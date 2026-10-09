import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const passwordResetTokenCreateMock = jest.fn();
const userFindOneMock = jest.fn();
const sendVerificationEmailMock = jest.fn();
const sendPasswordResetEmailMock = jest.fn();
const generateRandomTokenMock = jest.fn();
const hashTokenMock = jest.fn();
const comparePasswordMock = jest.fn();
const generateAccessTokenMock = jest.fn();
const generateRefreshTokenMock = jest.fn();
const hashPasswordMock = jest.fn();
const verifyRefreshTokenMock = jest.fn();
const getUserAccessProfileMock = jest.fn();
const normalizePermissionListMock = jest.fn((permissions) => permissions);
const recordAuditLogMock = jest.fn();

async function loadAuthService(nodeEnv = "development") {
    jest.resetModules();

    jest.unstable_mockModule("../../src/database/model/passwordResetToken.model.js", () => ({
        default: {
            create: passwordResetTokenCreateMock
        }
    }));

    jest.unstable_mockModule("../../src/database/model/role.model.js", () => ({
        default: {
            findOne: jest.fn()
        }
    }));

    jest.unstable_mockModule("../../src/database/model/session.model.js", () => ({
        default: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateMany: jest.fn()
        }
    }));

    jest.unstable_mockModule("../../src/database/model/user.model.js", () => ({
        default: {
            findOne: userFindOneMock,
            findById: jest.fn(),
            create: jest.fn()
        }
    }));

    jest.unstable_mockModule("../../src/database/model/verificationToken.model.js", () => ({
        default: {
            create: jest.fn(),
            findOne: jest.fn()
        }
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
        getUserAccessProfile: getUserAccessProfileMock,
        normalizePermissionList: normalizePermissionListMock
    }));

    return import("../../src/modules/auth/auth.service.js");
}

describe("requestPasswordReset", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("creates a reset token and sends a password reset email for an existing user", async () => {
        const { requestPasswordReset } = await loadAuthService("development");

        userFindOneMock.mockResolvedValue({
            _id: "user-id",
            email: "admin@example.com",
            firstName: "Admin"
        });
        generateRandomTokenMock.mockReturnValue("raw-reset-token");
        hashTokenMock.mockReturnValue("hashed-reset-token");
        passwordResetTokenCreateMock.mockResolvedValue({});
        sendPasswordResetEmailMock.mockResolvedValue({});

        const result = await requestPasswordReset({ email: "Admin@Example.com" });

        expect(userFindOneMock).toHaveBeenCalledWith({ email: "admin@example.com" });
        expect(passwordResetTokenCreateMock).toHaveBeenCalledWith({
            userId: "user-id",
            tokenHash: "hashed-reset-token",
            expiresAt: expect.any(Date)
        });
        expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
            to: "admin@example.com",
            firstName: "Admin",
            token: "raw-reset-token"
        });
        expect(result).toEqual({
            resetToken: "raw-reset-token"
        });
    });

    it("returns a generic response and does not send an email when the user does not exist", async () => {
        const { requestPasswordReset } = await loadAuthService("production");

        userFindOneMock.mockResolvedValue(null);

        const result = await requestPasswordReset({ email: "missing@example.com" });

        expect(passwordResetTokenCreateMock).not.toHaveBeenCalled();
        expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
        expect(result).toEqual({});
    });
});
