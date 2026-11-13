/**
 * Web Push with VAPID, no third-party service and no keys to configure.
 * VAPID keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY if set, otherwise
 * they are generated once and stored in app_settings so they stay stable.
 *
 * We send payload-less pushes ("tickles"): the service worker then fetches the
 * newest notification over the user's own authenticated session and shows it.
 * That means no notification text ever passes through the browser vendor's
 * push servers — good for privacy in a mental-health app.
 */
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { db, env } from "./db";

type Vapid = { publicKey: string; privateJwk: JsonWebKey };
const g = globalThis as unknown as { __pauseVapid?: Promise<Vapid> };

const b64url = (b: Buffer) => b.toString("base64url");

export function vapid(): Promise<Vapid> {
  if (!g.__pauseVapid) {
    g.__pauseVapid = (async () => {
      const pub = env("VAPID_PUBLIC_KEY");
      const priv = env("VAPID_PRIVATE_KEY");
      if (pub && priv) {
        const raw = Buffer.from(pub, "base64url");
        return {
          publicKey: pub,
          privateJwk: {
            kty: "EC",
            crv: "P-256",
            x: b64url(raw.subarray(1, 33)),
            y: b64url(raw.subarray(33, 65)),
            d: priv,
          },
        };
      }
      const sql = await db();
      const rows = await sql`select value from app_settings where key = 'vapid'`;
      if (rows[0]) return rows[0]["value"] as Vapid;
      const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
      const jwk = privateKey.export({ format: "jwk" });
      const pubJwk = publicKey.export({ format: "jwk" });
      const raw = Buffer.concat([
        Buffer.from([4]),
        Buffer.from(pubJwk.x!, "base64url"),
        Buffer.from(pubJwk.y!, "base64url"),
      ]);
      const value: Vapid = { publicKey: b64url(raw), privateJwk: jwk };
      await sql`insert into app_settings (key, value) values ('vapid', ${sql.json(value as never)}) on conflict (key) do nothing`;
      const again = await sql`select value from app_settings where key = 'vapid'`;
      return again[0]!["value"] as Vapid;
    })().catch((e) => {
      g.__pauseVapid = undefined;
      throw e;
    });
  }
  return g.__pauseVapid;
}

async function vapidHeader(endpoint: string) {
  const v = await vapid();
  const aud = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env("VAPID_SUBJECT", env("APP_URL", "mailto:hello@example.com")),
      }),
    ),
  );
  const key = createPrivateKey({ key: v.privateJwk as never, format: "jwk" });
  const sig = sign("sha256", Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${v.publicKey}`;
}

/** Wake every registered browser for this user. Failures never break the caller. */
export async function pushTo(userId: string) {
  try {
    const sql = await db();
    const subs = await sql<
      { id: string; endpoint: string }[]
    >`select id, endpoint from push_subscriptions where user_id = ${userId}`;
    await Promise.all(
      subs.map(async (s) => {
        try {
          const res = await fetch(s.endpoint, {
            method: "POST",
            headers: {
              authorization: await vapidHeader(s.endpoint),
              ttl: "86400",
              urgency: "normal",
              "content-length": "0",
            },
          });
          if (res.status === 404 || res.status === 410)
            await sql`delete from push_subscriptions where id = ${s.id}`;
        } catch {
          /* network hiccup: try again next notification */
        }
      }),
    );
  } catch (e) {
    console.warn("[push] failed", e);
  }
}
