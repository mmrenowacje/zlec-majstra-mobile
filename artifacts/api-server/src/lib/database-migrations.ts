import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const migrations = [
  {
    name: "0001_subscription_reminders",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0001_subscription_reminders.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0001_subscription_reminders.sql"),
    ],
  },
  {
    name: "0002_reviews",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0002_reviews.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0002_reviews.sql"),
    ],
  },
  {
    name: "0003_conversations",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0003_conversations.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0003_conversations.sql"),
    ],
  },
  {
    name: "0004_conversation_message_read_states",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0004_conversation_message_read_states.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0004_conversation_message_read_states.sql"),
    ],
  },
  {
    name: "0005_request_addresses",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0005_request_addresses.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0005_request_addresses.sql"),
    ],
  },
  {
    name: "0006_project_photos",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0006_project_photos.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0006_project_photos.sql"),
    ],
  },
  {
    name: "0007_request_categories",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0007_request_categories.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0007_request_categories.sql"),
    ],
  },
  {
    name: "0008_contractor_service_locations",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0008_contractor_service_locations.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0008_contractor_service_locations.sql"),
    ],
  },
  {
    name: "0009_payment_consents",
    candidatePaths: [
      resolve(process.cwd(), "lib/db/migrations/0009_payment_consents.sql"),
      resolve(process.cwd(), "../../lib/db/migrations/0009_payment_consents.sql"),
    ],
  },
] as const;

async function readMigration(candidatePaths: readonly string[]) {
  for (const path of candidatePaths) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Migration file not found: ${candidatePaths.join(", ")}`);
}

export async function runDatabaseMigrations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [739_132_001]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        name text PRIMARY KEY,
        applied_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query<{ name: string }>(
        "SELECT name FROM app_migrations WHERE name = $1",
        [migration.name],
      );
      if (applied.rowCount) continue;

      const sql = await readMigration(migration.candidatePaths);
      await client.query(sql);
      await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [
        migration.name,
      ]);
      logger.info({ migration: migration.name }, "Database migration applied");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
