import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Vercel Neon zet meestal DATABASE_URL; oudere templates ook POSTGRES_URL. */
export function databaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    ""
  );
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL / POSTGRES_URL ontbreekt");
  }
  if (!_db) {
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}
