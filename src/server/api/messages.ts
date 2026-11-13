import { z } from "zod";
import { db } from "../db";
import { getAuth, publicName, requireAdult, requireVerifiedAdult, requireUser } from "../auth";
import { HttpError, bad, body, clean, forbidden, notFound, rateLimit } from "../http";
import { route } from "../router";
import { autoReport, bus, ensureListening, isPremium, moderateText, notify, publish, type RealtimeEvent } from "../services";

type Sql = Awaited<ReturnType<typeof db>>;
const FREE_DM_DAILY = 40;

async function membership(sql: Sql, conversationId: string, userId: string) {
  const rows = await sql`select cm.status, cm.muted, c.is_group, c.title from conversation_members cm join conversations c on c.id = cm.conversation_id
    where cm.conversation_id = ${conversationId} and cm.user_id = ${userId}`;
  return rows[0] as { status: string; muted: boolean; is_group: boolean; title: string } | undefined;
}

async function isBlockedEitherWay(sql: Sql, a: string, b: string) {
  const r = await sql`select 1 from blocks where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a}) limit 1`;
  return r.length > 0;
}

const memberName = (sql: Sql) =>
  sql`case when u.identity_mode = 'name' then u.display_name else u.community_alias end`;

route("GET", "/messages/conversations", async ({ request }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const rows = await sql`
    select c.id, c.is_group, c.title, c.last_message_at, cm.status, cm.muted,
      (c.last_message_at > cm.last_read_at) as unread,
      (select json_build_object('body', case when m.deleted_at is not null then 'Message deleted' when m.kind <> 'text' then '[' || m.kind || ']' else left(m.body, 80) end, 'sender', m.sender_id, 'at', m.created_at)
        from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last,
      (select json_agg(json_build_object('id', u.id, 'name', ${memberName(sql)}, 'handle', u.community_alias, 'style', u.avatar_style,
          'online', (u.prefs->>'showOnline')::boolean is true and u.last_seen_at > now() - interval '3 minutes'))
        from conversation_members o join users u on u.id = o.user_id where o.conversation_id = c.id and o.user_id <> ${user.id} and o.status <> 'left') as members
    from conversation_members cm join conversations c on c.id = cm.conversation_id
    where cm.user_id = ${user.id} and cm.status <> 'left'
    order by c.last_message_at desc limit 100`;
  return { conversations: rows };
});

route("POST", "/messages/conversations", async ({ request }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`conv:${user.id}`, 20, 60 * 60 * 1000);
  const input = await body(request, z.object({ handles: z.array(z.string().max(40)).min(1).max(20), title: z.string().max(60).optional() }));
  const sql = await db();
  const others = await sql<{ id: string; prefs: Record<string, unknown> }[]>`select id, prefs from users
    where lower(community_alias) in ${sql(input.handles.map((h) => h.toLowerCase()))} and age_group = 'adult' and status = 'active' and id <> ${user.id}`;
  if (!others.length) throw notFound("We couldn't find that member.");
  for (const o of others) if (await isBlockedEitherWay(sql, user.id, o.id)) throw forbidden("You can't message this member.");
  const group = others.length > 1;
  if (group && !(await isPremium(user))) throw forbidden("Group chats are part of Premium.", "premium_required");

  if (!group) {
    const existing = await sql`select c.id from conversations c
      join conversation_members a on a.conversation_id = c.id and a.user_id = ${user.id}
      join conversation_members b on b.conversation_id = c.id and b.user_id = ${others[0]!.id}
      where not c.is_group limit 1`;
    if (existing[0]) {
      await sql`update conversation_members set status = 'accepted' where conversation_id = ${existing[0]["id"]} and user_id = ${user.id}`;
      return { id: existing[0]["id"] };
    }
  }
  const [c] = await sql`insert into conversations (is_group, title, created_by) values (${group}, ${clean(input.title ?? "", 60)}, ${user.id}) returning id`;
  const id = c!["id"] as string;
  await sql`insert into conversation_members (conversation_id, user_id, status) values (${id}, ${user.id}, 'accepted')`;
  for (const o of others) {
    // People who don't already follow the sender get a message request first.
    const follows = await sql`select 1 from follows where follower_id = ${o.id} and followee_id = ${user.id}`;
    const status = follows.length ? "accepted" : "pending";
    await sql`insert into conversation_members (conversation_id, user_id, status) values (${id}, ${o.id}, ${status})`;
  }
  return { id };
});

route("GET", "/messages/conversations/:id", async ({ request, params, url }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const m = await membership(sql, params["id"]!, user.id);
  if (!m || m.status === "left") throw notFound();
  const before = url.searchParams.get("before");
  const cursor = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : new Date(Date.now() + 60000);
  const messages = await sql`
    select m.id, m.sender_id, case when m.deleted_at is null then m.body else '' end as body, m.kind,
      case when m.deleted_at is null then m.media_id end as media_id, m.reply_to, m.created_at, (m.deleted_at is not null) as deleted,
      (select json_object_agg(r.user_id, r.emoji) from message_reactions r where r.message_id = m.id) as reactions,
      (select left(p.body, 80) from messages p where p.id = m.reply_to) as reply_body
    from messages m where m.conversation_id = ${params["id"]!} and m.created_at < ${cursor}
      and not exists (select 1 from blocks b where b.blocker_id = ${user.id} and b.blocked_id = m.sender_id)
    order by m.created_at desc limit 50`;
  const members = await sql`select u.id, ${memberName(sql)} as name, u.community_alias as handle, u.avatar_style as style, cm.status,
      case when (u.prefs->>'readReceipts')::boolean is false then null else cm.last_read_at end as last_read_at,
      (u.prefs->>'showOnline')::boolean is true and u.last_seen_at > now() - interval '3 minutes' as online
    from conversation_members cm join users u on u.id = cm.user_id where cm.conversation_id = ${params["id"]!} and cm.status <> 'left'`;
  return { conversation: { id: params["id"], ...m }, members, messages: messages.reverse(), me: user.id };
});

route("POST", "/messages/conversations/:id", async ({ request, params }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`dm:${user.id}`, 60, 60 * 1000);
  const input = await body(
    request,
    z.object({
      body: z.string().max(4000).default(""),
      kind: z.enum(["text", "image", "voice"]).default("text"),
      mediaId: z.string().uuid().nullable().optional(),
      replyTo: z.string().uuid().nullable().optional(),
    }),
  );
  const sql = await db();
  const m = await membership(sql, params["id"]!, user.id);
  if (!m || m.status === "left") throw notFound();
  if (m.status === "pending") throw forbidden("Accept this message request to reply.");
  const text = clean(input.body, 4000);
  if (input.kind === "text" && !text) throw bad("Message is empty.");
  if (input.kind !== "text") {
    if (!input.mediaId) throw bad("Attach a file.");
    const media = await sql`select 1 from uploads where id = ${input.mediaId} and owner_id = ${user.id} and conversation_id = ${params["id"]!}`;
    if (!media.length) throw bad("Attachment not found.");
  }
  const others = await sql<{ user_id: string; muted: boolean; status: string }[]>`select user_id, muted, status from conversation_members
    where conversation_id = ${params["id"]!} and user_id <> ${user.id} and status <> 'left'`;
  if (!m.is_group && others[0] && (await isBlockedEitherWay(sql, user.id, others[0].user_id))) throw forbidden("You can't message this member.");
  if (!(await isPremium(user))) {
    const [count] = await sql`select count(*)::int as n from messages where sender_id = ${user.id} and created_at > now() - interval '1 day'`;
    if ((count?.["n"] as number) >= FREE_DM_DAILY) throw new HttpError(429, `Free accounts can send ${FREE_DM_DAILY} messages a day. Premium removes the limit.`, "premium_required");
  }
  // Pending requests: the sender may send one message until the request is accepted.
  if (!m.is_group && others[0]?.status === "pending") {
    const sent = await sql`select count(*)::int as n from messages where conversation_id = ${params["id"]!} and sender_id = ${user.id}`;
    if ((sent[0]?.["n"] as number) >= 1) throw forbidden("Waiting for them to accept your message request.", "request_pending");
  }
  const verdict = moderateText(text);
  if (verdict.action === "block") throw bad("This message breaks our community guidelines, so it wasn't sent.", "moderation_blocked");
  const [msg] = await sql`insert into messages (conversation_id, sender_id, body, kind, media_id, reply_to)
    values (${params["id"]!}, ${user.id}, ${text}, ${input.kind}, ${input.mediaId ?? null}, ${input.replyTo ?? null}) returning id, created_at`;
  if (verdict.action === "review") await autoReport("message", msg!["id"] as string, verdict.reasons);
  await sql`update conversations set last_message_at = now() where id = ${params["id"]!}`;
  await sql`update conversation_members set last_read_at = now() where conversation_id = ${params["id"]!} and user_id = ${user.id}`;
  const recipients = others.map((o) => o.user_id);
  await publish({ users: [user.id, ...recipients], type: "message", data: { conversationId: params["id"], id: msg!["id"] } });
  for (const o of others) {
    if (!o.muted) {
      await notify(o.user_id, "message", o.status === "accepted" ? `New message from ${publicName(user)}` : `Message request from ${publicName(user)}`, input.kind === "text" ? text.slice(0, 100) : `Sent a ${input.kind}`, `/messages/${params["id"]}`);
    }
  }
  return { id: msg!["id"], createdAt: msg!["created_at"] };
});

route("POST", "/messages/conversations/:id/read", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  await sql`update conversation_members set last_read_at = now() where conversation_id = ${params["id"]!} and user_id = ${user.id}`;
  const others = await sql`select user_id from conversation_members where conversation_id = ${params["id"]!} and user_id <> ${user.id}`;
  if (user.prefs["readReceipts"] !== false) await publish({ users: others.map((o) => o["user_id"] as string), type: "read", data: { conversationId: params["id"] } });
  return { ok: true };
});

route("POST", "/messages/conversations/:id/request", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const { accept } = await body(request, z.object({ accept: z.boolean() }));
  const sql = await db();
  await sql`update conversation_members set status = ${accept ? "accepted" : "left"} where conversation_id = ${params["id"]!} and user_id = ${user.id} and status = 'pending'`;
  return { ok: true };
});

route("PATCH", "/messages/conversations/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const { muted } = await body(request, z.object({ muted: z.boolean() }));
  const sql = await db();
  await sql`update conversation_members set muted = ${muted} where conversation_id = ${params["id"]!} and user_id = ${user.id}`;
  return { ok: true };
});

route("DELETE", "/messages/conversations/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  await sql`update conversation_members set status = 'left' where conversation_id = ${params["id"]!} and user_id = ${user.id}`;
  const remaining = await sql`select 1 from conversation_members where conversation_id = ${params["id"]!} and status <> 'left' limit 1`;
  if (!remaining.length) await sql`delete from conversations where id = ${params["id"]!}`;
  return { ok: true };
});

route("DELETE", "/messages/:id", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const sql = await db();
  const rows = await sql`update messages set deleted_at = now(), body = '' where id = ${params["id"]!} and sender_id = ${user.id} returning conversation_id`;
  if (!rows.length) throw notFound();
  const members = await sql`select user_id from conversation_members where conversation_id = ${rows[0]!["conversation_id"]}`;
  await publish({ users: members.map((m) => m["user_id"] as string), type: "message", data: { conversationId: rows[0]!["conversation_id"] } });
  return { ok: true };
});

route("POST", "/messages/:id/react", async ({ request, params }) => {
  const { user } = await requireAdult(request);
  const { emoji } = await body(request, z.object({ emoji: z.enum(["❤️", "🤗", "👍", "😂", "😮", "😢", "🙏"]).nullable() }));
  const sql = await db();
  const [m] = await sql`select m.conversation_id from messages m join conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = ${params["id"]!} and cm.user_id = ${user.id} and cm.status = 'accepted'`;
  if (!m) throw notFound();
  if (emoji) await sql`insert into message_reactions (message_id, user_id, emoji) values (${params["id"]!}, ${user.id}, ${emoji}) on conflict (message_id, user_id) do update set emoji = excluded.emoji`;
  else await sql`delete from message_reactions where message_id = ${params["id"]!} and user_id = ${user.id}`;
  const members = await sql`select user_id from conversation_members where conversation_id = ${m["conversation_id"]}`;
  await publish({ users: members.map((x) => x["user_id"] as string), type: "message", data: { conversationId: m["conversation_id"] } });
  return { ok: true };
});

// ---------------------------------------------------------------- media
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_AUDIO = 3 * 1024 * 1024;

function sniff(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return "image/gif";
  if (b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return "audio/webm";
  if (b(0) === 0x4f && b(1) === 0x67 && b(2) === 0x67 && b(3) === 0x53) return "audio/ogg";
  if (b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) return "audio/mp4";
  return null;
}

/** Remove EXIF/XMP/comment segments from JPEGs (GPS location lives there). */
function stripJpeg(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // malformed: keep original
    const marker = buf[i + 1]!;
    if (marker === 0xda) {
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    const isMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe; // APP1–APP15, COM
    if (!isMeta) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return buf;
}

/** Remove text/EXIF/time chunks from PNGs. */
function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (!["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) out.push(buf.subarray(i, end));
    i = end;
  }
  return Buffer.concat(out);
}

route("POST", "/media", async ({ request, url }) => {
  const { user } = await requireVerifiedAdult(request);
  rateLimit(`upload:${user.id}`, 40, 60 * 60 * 1000);
  const scope = url.searchParams.get("scope") === "message" ? "message" : "public";
  const conversationId = url.searchParams.get("conversationId");
  const sql = await db();
  if (scope === "message") {
    if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) throw bad("Missing conversation.");
    const m = await membership(sql, conversationId, user.id);
    if (!m || m.status !== "accepted") throw forbidden();
  }
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE) throw bad("That file is too large (max 4 MB).");
  let buf: Buffer = Buffer.from(await request.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw bad("Only JPEG, PNG, WebP or GIF images and WebM/Ogg/MP4 audio are supported.");
  if (mime.startsWith("audio/") && (scope !== "message" || buf.length > MAX_AUDIO)) throw bad("Voice notes must be under 3 MB and only in messages.");
  if (buf.length > MAX_IMAGE) throw bad("That file is too large (max 4 MB).");
  if (mime === "image/jpeg") buf = stripJpeg(buf);
  if (mime === "image/png") buf = stripPng(buf);
  const [row] = await sql`insert into uploads (owner_id, mime, size, scope, conversation_id, data)
    values (${user.id}, ${mime}, ${buf.length}, ${scope}, ${scope === "message" ? conversationId : null}, ${buf}) returning id`;
  return { id: row!["id"], mime };
});

route("GET", "/media/:id", async ({ request, params }) => {
  const auth = await getAuth(request);
  if (!auth) throw new HttpError(401, "Please sign in.");
  const sql = await db();
  const [u] = await sql`select owner_id, mime, scope, conversation_id, data from uploads where id = ${params["id"]!}`;
  if (!u) throw notFound();
  const own = u["owner_id"] === auth.user.id;
  if (!own) {
    // Community media is visible to adults only; message media only to that conversation.
    if (auth.user.age_group !== "adult" || auth.childMode) throw forbidden();
    if (u["scope"] === "message") {
      const m = await membership(sql, u["conversation_id"] as string, auth.user.id);
      if (!m || m.status === "left") throw forbidden();
    }
  }
  return new Response(new Uint8Array(u["data"] as Buffer), {
    headers: {
      "content-type": u["mime"] as string,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
});

// ---------------------------------------------------------------- realtime stream
route("GET", "/events", async ({ request }) => {
  const auth = await requireUser(request);
  await ensureListening();
  const sql = await db();
  const userId = auth.user.id;
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (ev: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const onEvent = (ev: RealtimeEvent) => send(ev.type, ev.data ?? {});
      bus.on(`user:${userId}`, onEvent);
      const beat = setInterval(() => {
        send("ping", { t: Date.now() });
        void sql`update users set last_seen_at = now() where id = ${userId}`.catch(() => {});
      }, 25000);
      void sql`update users set last_seen_at = now() where id = ${userId}`.catch(() => {});
      send("ready", { ok: true });
      cleanup = () => {
        clearInterval(beat);
        bus.off(`user:${userId}`, onEvent);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
});

// ---------------------------------------------------------------- notifications
route("GET", "/notifications", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  const rows = await sql`select id, kind, title, body, link, read_at, created_at from notifications where user_id = ${user.id} order by created_at desc limit 60`;
  return { notifications: rows };
});

route("POST", "/notifications/read", async ({ request }) => {
  const { user } = await requireUser(request);
  const sql = await db();
  await sql`update notifications set read_at = now() where user_id = ${user.id} and read_at is null`;
  return { ok: true };
});

// ---------------------------------------------------------------- contact us
route("POST", "/contact", async ({ request }) => {
  const { clientIp } = await import("../http");
  rateLimit(`contact:${clientIp(request)}`, 5, 60 * 60 * 1000);
  const auth = await getAuth(request);
  const input = await body(
    request,
    z.object({
      name: z.string().min(1).max(80),
      email: z.string().email().max(200),
      topic: z.enum(["general", "support", "billing", "privacy", "safety", "partnership", "feedback"]),
      message: z.string().min(10).max(5000),
      website: z.string().max(0).optional(), // honeypot: real people leave it empty
    }),
  );
  const sql = await db();
  await sql`insert into contact_messages (user_id, name, email, topic, message)
    values (${auth?.user.id ?? null}, ${clean(input.name, 80)}, ${input.email.toLowerCase()}, ${input.topic}, ${clean(input.message, 5000)})`;
  const admins = await sql`select id from users where role = 'admin' and status = 'active'`;
  for (const a of admins) await notify(a["id"] as string, "moderation", `New contact message: ${input.topic}`, clean(input.message, 100), "/admin?tab=contact");
  return { ok: true };
});
