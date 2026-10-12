-- Adds the audit timestamp written by auth.service.js on password reset
-- (resetPassword) and self-service password change (changePassword).
-- `User.passwordChangedAt` keeps the model in sync with those writes so
-- POST /auth/reset-password and PATCH /auth/update-password stop failing
-- with Prisma `Unknown argument 'passwordChangedAt'`.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
