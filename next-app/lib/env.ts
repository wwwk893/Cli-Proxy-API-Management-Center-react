import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .trim()
    .regex(/^[-a-zA-Z0-9+.]+:\/\//, {
      message: "DATABASE_URL must be a valid URL",
    }),
  CLIPROXY_MANAGEMENT_BASE: z
    .string()
    .url({ message: "CLIPROXY_MANAGEMENT_BASE must be a valid URL" })
    .default("http://localhost:3818/v0/management"),
  CLIPROXY_MANAGEMENT_KEY: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1, "CLIPROXY_MANAGEMENT_KEY is required").optional()),
  AUTH_ENCRYPTION_KEY: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1, "AUTH_ENCRYPTION_KEY is required").optional()),
  AUTH_SESSION_TTL_DAYS: z.coerce
    .number({ message: "AUTH_SESSION_TTL_DAYS must be a number" })
    .int()
    .min(1)
    .max(365)
    .default(30),
  AUTH_COOKIE_NAME: z.string().trim().min(1).default("cpa_session"),
  USAGE_INGEST_MAX_EVENTS_PER_RUN: z.coerce
    .number({ message: "USAGE_INGEST_MAX_EVENTS_PER_RUN must be a number" })
    .int()
    .positive()
    .default(2000),
  USAGE_INGEST_BACKFILL_SINCE: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }, z.date().optional()),
  USAGE_INGEST_DRY_RUN: z
    .enum(["true", "false"], { message: "USAGE_INGEST_DRY_RUN must be true or false" })
    .default("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url({ message: "NEXT_PUBLIC_SITE_URL must be a valid URL" })
    .default("http://localhost:3000"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url({ message: "NEXT_PUBLIC_SITE_URL must be a valid URL" })
    .default("http://localhost:3000"),
});

const serverEnv = serverSchema.parse(process.env);
const clientEnv = clientSchema.parse(process.env);

export { clientEnv, serverEnv };
