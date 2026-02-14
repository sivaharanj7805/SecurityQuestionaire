import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { validateEnv } from "@/lib/env";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function createDb() {
  // Validate all environment variables on first DB access
  validateEnv();

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const isProduction = process.env.NODE_ENV === "production";

  const client = postgres(connectionString, {
    ssl: isProduction ? "require" : false,
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      _db = createDb();
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
