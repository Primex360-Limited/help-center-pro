/**
 * One-off cleanup: remove demo/test rows created by older builds.
 *
 * Older versions of `seedTestUser` provisioned a demo workspace ("Primex360")
 * plus test tenant admins, which made the Admin Portal report workspaces,
 * seats and MRR that never existed. This script removes only those known demo
 * rows, writes a JSON backup first, and refuses to touch a demo workspace that
 * has real support traffic.
 *
 * Usage (from the backend folder):
 *   node scripts/purge-seeded-demo-data.mjs           # dry run
 *   node scripts/purge-seeded-demo-data.mjs --apply   # delete + backup
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../src/database/prisma/client.js";
import { purgeDemoTickets } from "../src/modules/tickets/purgeDemoData.js";

const APPLY = process.argv.includes("--apply");

/** Emails only ever created by the old demo seeding. */
const DEMO_EMAILS = [
    "test@test.com",
    "amaka@primex360.com",
    "admin@helpcentrepro.com",
    "jetsamjoseph@gmail.com"
];

/** Slugs the old seeding used for its demo workspace. */
const DEMO_TENANT_SLUGS = ["primex360", "demo"];

/** Never delete these, whatever else matches. */
const PROTECTED_EMAILS = ["ebube.okechukwu@primex360.com"];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.join(__dirname, "..", "backups");

function stamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
    const demoTenants = await prisma.tenant.findMany({
        where: { slug: { in: DEMO_TENANT_SLUGS } }
    });

    const purgeableTenants = [];
    for (const tenant of demoTenants) {
        const tickets = await prisma.ticket.count({ where: { tenantId: tenant.id } });
        if (tickets > 0) {
            console.warn(
                `[purge] SKIP tenant ${tenant.slug}: has ${tickets} real ticket(s). Remove manually if intended.`
            );
            continue;
        }
        purgeableTenants.push(tenant);
    }

    const tenantIds = purgeableTenants.map((tenant) => tenant.id);
    const demoUsers = (
        await prisma.user.findMany({
            where: {
                email: { in: DEMO_EMAILS },
                OR: [{ tenantId: null }, { tenantId: { in: tenantIds } }]
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                userType: true,
                tenantId: true,
                createdAt: true
            }
        })
    ).filter((user) => !PROTECTED_EMAILS.includes(String(user.email).toLowerCase()));

    const summary = {
        tenants: purgeableTenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            status: tenant.status,
            createdAt: tenant.createdAt
        })),
        users: demoUsers
    };

    if (!summary.tenants.length && !summary.users.length) {
        console.log("[purge] Nothing to remove — no seeded demo rows found.");
        return;
    }

    console.log("[purge] Demo tenants:", summary.tenants.length);
    summary.tenants.forEach((t) => console.log(`  - ${t.name} (${t.slug})`));
    console.log("[purge] Demo users:", summary.users.length);
    summary.users.forEach((u) => console.log(`  - ${u.email} (${u.userType})`));

    if (!APPLY) {
        console.log("[purge] Dry run. Re-run with --apply to delete these rows.");
        return;
    }

    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `seeded-demo-data-${stamp()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`[purge] Backup written: ${backupPath}`);

    if (demoUsers.length) {
        const removed = await prisma.user.deleteMany({
            where: { id: { in: demoUsers.map((user) => user.id) } }
        });
        console.log(`[purge] Deleted ${removed.count} demo user(s).`);
    }

    if (tenantIds.length) {
        const removed = await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
        console.log(`[purge] Deleted ${removed.count} demo workspace(s) (cascade).`);
    }

    const tickets = await purgeDemoTickets();
    console.log(`[purge] Removed ${tickets} demo ticket(s).`);
    console.log("[purge] Done.");
}

main()
    .catch((error) => {
        console.error("[purge] Failed:", error?.message || error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect().catch(() => {});
    });
