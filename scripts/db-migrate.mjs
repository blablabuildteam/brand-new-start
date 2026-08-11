/**
 * Apply drizzle/*.sql to DATABASE_URL (Neon / Postgres).
 * Usage: npm run db:migrate
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of p.read ? [] : readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

loadEnvLocal();

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim();
if (!url) {
  console.error("DATABASE_URL / POSTGRES_URL ontbreekt — pull van Vercel of plak in .env.local.");
  process.exit(1);
}

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = neon(url);

function stripSqlComments(body) {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return "";
      return line;
    })
    .join("\n");
}

for (const file of files) {
  const body = stripSqlComments(readFileSync(join(dir, file), "utf8"));
  console.log(`→ ${file}`);
  const statements = body
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await sql.query(statement);
  }
}

console.log(`Klaar · ${files.length} migratie(s)`);
