import pg from "pg";

const { Client } = pg;
const admin = new Client({
    connectionString: "postgresql://postgres:password@localhost:5432/postgres"
});

try {
    await admin.connect();
    console.log("CONNECTED: postgres/password works on 5432");
    const existing = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname = 'help_center_pro'"
    );
    if (!existing.rows.length) {
        await admin.query("CREATE DATABASE help_center_pro");
        console.log("CREATED database help_center_pro");
    } else {
        console.log("Database help_center_pro already exists");
    }
} catch (error) {
    console.log("FAILED:", error.message);
    process.exitCode = 1;
} finally {
    await admin.end().catch(() => {});
}
