import User from "../../database/model/user.model.js";
import Role from "../../database/model/role.model.js";
import { env } from "../../config/env.js";
import { SYSTEM_ROLE, USER_STATUS } from "../../shared/constants/system.js";
import { hashPassword } from "./auth.utils.js";
import { seedDefaultRoles } from "../roles/seedDefaultRoles.js";

const DEV_TEST_USERS = [
    {
        email: "test@test.com",
        password: "test",
        firstName: "Test",
        lastName: "User"
    },
    {
        email: "jetsamjoseph@gmail.com",
        password: "2020/EN/12566",
        firstName: "Joseph",
        lastName: "Jetsam"
    }
];

async function upsertTestUser(superAdminRole, account) {
    const email = account.email.toLowerCase().trim();
    const passwordHash = await hashPassword(account.password);
    let user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
        user = await User.create({
            email,
            passwordHash,
            firstName: account.firstName,
            lastName: account.lastName,
            roleId: superAdminRole._id,
            status: USER_STATUS.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            mustChangePassword: false,
            deniedPermissions: []
        });
        console.log(`Dev test user ready: ${email}`);
        return user;
    }

    user.passwordHash = passwordHash;
    user.firstName = account.firstName;
    user.lastName = account.lastName;
    user.roleId = superAdminRole._id;
    user.status = USER_STATUS.ACTIVE;
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.mustChangePassword = false;
    await user.save();

    console.log(`Dev test user updated: ${email}`);
    return user;
}

export async function seedTestUser() {
    if (env.NODE_ENV === "production" || !env.SEED_TEST_USER) {
        return null;
    }

    await seedDefaultRoles();

    const superAdminRole = await Role.findOne({ name: SYSTEM_ROLE.SUPER_ADMIN });
    if (!superAdminRole) {
        throw new Error("Super Admin role missing; cannot seed test user");
    }

    const users = [];
    for (const account of DEV_TEST_USERS) {
        users.push(await upsertTestUser(superAdminRole, account));
    }

    return users;
}

export default seedTestUser;
