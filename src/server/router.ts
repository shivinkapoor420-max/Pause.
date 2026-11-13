import { HttpError, json } from "./http";
import { env } from "./db";

export type Ctx = { request: Request; url: URL; params: Record<string, string> };
export type Handler = (ctx: Ctx) => Promise<unknown>;
type Route = { method: string; parts: string[]; handler: Handler };

const routes: Route[] = [];

export function route(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  handler: Handler,
) {
  routes.push({ method, parts: path.split("/").filter(Boolean), handler });
}

function match(parts: string[], path: string[]) {
  if (parts.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const v = path[i]!;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(v);
    else if (p !== v) return null;
  }
  return params;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Requests that change state must come from our own origin (CSRF defence on top of SameSite cookies). */
function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GET navigations
  const allowed = new Set([url.origin, env("APP_URL").replace(/\/$/, "")].filter(Boolean));
  return allowed.has(origin);
}

export async function dispatch(request: Request, prefix: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(prefix.length).split("/").filter(Boolean);
  try {
    if (request.method !== "GET" && !path[0]?.startsWith("webhooks") && !sameOrigin(request, url)) {
      throw new HttpError(403, "Cross-site request blocked.", "csrf");
    }
    let methodMismatch = false;
    for (const r of routes) {
      const params = match(r.parts, path);
      if (!params) continue;
      if (r.method !== request.method) {
        methodMismatch = true;
        continue;
      }
      for (const [k, v] of Object.entries(params)) {
        if ((k === "id" || k.endsWith("Id")) && !uuidRe.test(v))
          throw new HttpError(404, "Not found.", "not_found");
      }
      const result = await r.handler({ request, url, params });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    }
    throw new HttpError(
      methodMismatch ? 405 : 404,
      methodMismatch ? "Method not allowed." : "Not found.",
      "not_found",
    );
  } catch (e) {
    if (e instanceof HttpError)
      return json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[api]", request.method, url.pathname, e);
    return json(
      { error: "Something went wrong on our side. Please try again.", code: "server_error" },
      { status: 500 },
    );
  }
}
