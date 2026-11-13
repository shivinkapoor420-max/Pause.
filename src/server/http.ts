import { z, type ZodTypeAny } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const bad = (msg: string, code = "bad_request") => new HttpError(400, msg, code);
export const unauthorized = (msg = "Please sign in.") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to this.", code = "forbidden") =>
  new HttpError(403, msg, code);
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "not_found");

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function body<T extends ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw bad("Request body must be JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw bad(
      issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input.",
      "validation",
    );
  }
  return parsed.data;
}

/** Strip control characters and trim; React escapes output, so no HTML encoding is needed here. */
export function clean(text: string, max = 5000) {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max)
  );
}

// ---------------------------------------------------------------- rate limiting
// Fixed-window counters stored in Postgres (an UNLOGGED table, so it's fast),
// which means limits hold across any number of server instances. If the
// database is briefly unavailable we fall back to an in-memory window rather
// than blocking people.
const buckets = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) buckets.clear();
  return true;
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  let ok: boolean;
  try {
    const { db } = await import("./db");
    const sql = await db();
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const [row] =
      await sql`insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
      on conflict (key, window_start) do update set count = rate_limits.count + 1 returning count`;
    ok = ((row?.["count"] as number) ?? 1) <= limit;
  } catch {
    ok = memoryLimit(key, limit, windowMs);
  }
  if (!ok) {
    throw new HttpError(
      429,
      "You're going a little fast — please wait a moment and try again.",
      "rate_limited",
    );
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}
