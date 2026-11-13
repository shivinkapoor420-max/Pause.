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
export const forbidden = (msg = "You don't have access to this.", code = "forbidden") => new HttpError(403, msg, code);
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
    throw bad(issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input.", "validation");
  }
  return parsed.data;
}

/** Strip control characters and trim; React escapes output, so no HTML encoding is needed here. */
export function clean(text: string, max = 5000) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

// ---------------------------------------------------------------- rate limiting
// In-memory sliding window. Good for a single server instance; swap for Redis
// (e.g. Upstash) when running several instances behind a load balancer.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    throw new HttpError(429, "You're going a little fast — please wait a moment and try again.", "rate_limited");
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) buckets.clear();
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}
