-- Adds the profile-setup fields that are part of the `User` model but were
-- never created by an earlier migration.
--
-- Written by:
--   * auth.service.js        -> completeUserProfile()
--   * tenant.service.js      -> inviteAgent()
--   * src/seed               -> seeded admin/agent users
--
-- Without these columns `prisma migrate deploy` leaves the database out of
-- sync with schema.prisma and the auth-service seed crashes with:
--   Invalid `prisma.user.update()` invocation:
--   The column `User.timezone` does not exist in the current database.
-- which takes the whole auth-service (and therefore every login) offline.
ALTER TABLE "User"
    ADD COLUMN     "timezone" TEXT,
    ADD COLUMN     "industry" TEXT,
    ADD COLUMN     "language" TEXT,
    ADD COLUMN     "companySize" TEXT,
    ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false;
