import { z } from "zod";
import { db } from "../db";
import { audit, getAuth, requireStaff } from "../auth";
import { bad, body, clean, clientIp, forbidden, notFound, rateLimit } from "../http";
import { route } from "../router";
import { moderateText, notify } from "../services";

/**
 * Community blog — "Park a thought". Anyone 18+ can submit (signed in or not).
 * Nothing is public until a moderator approves it; approved pieces stay up.
 */
const topics = [
  "thoughts",
  "recovery",
  "adhd",
  "anxiety",
  "hope",
  "relationships",
  "work",
  "gratitude",
] as const;

route("GET", "/blog", async ({ url }) => {
  const sql = await db();
  const topic = url.searchParams.get("topic");
  const rows =
    await sql`select id, pen_name, title, left(body, 320) as excerpt, topic, hearts, published_at,
      (length(body) / 1000 + 1)::int as minutes
    from blog_posts where status = 'published' ${topic && (topics as readonly string[]).includes(topic) ? sql`and topic = ${topic}` : sql``}
    order by published_at desc limit 60`;
  return { posts: rows, topics };
});

route("GET", "/blog/:id", async ({ params }) => {
  const sql = await db();
  const [p] =
    await sql`select id, pen_name, title, body, topic, hearts, published_at from blog_posts where id = ${params["id"]!} and status = 'published'`;
  if (!p) throw notFound("This piece isn't available.");
  return { post: p };
});

route("POST", "/blog/:id/heart", async ({ request, params }) => {
  await rateLimit(`heart:${clientIp(request)}:${params["id"]}`, 1, 24 * 60 * 60 * 1000);
  const sql = await db();
  await sql`update blog_posts set hearts = hearts + 1 where id = ${params["id"]!} and status = 'published'`;
  return { ok: true };
});

route("POST", "/blog", async ({ request }) => {
  await rateLimit(`blog:${clientIp(request)}`, 4, 24 * 60 * 60 * 1000);
  const auth = await getAuth(request);
  if (auth && (auth.user.age_group !== "adult" || auth.childMode))
    throw forbidden(
      "The blog is for adults (18+). Your journal is a great private place for your thoughts.",
    );
  const input = await body(
    request,
    z.object({
      penName: z.string().max(40).optional(),
      title: z.string().min(3).max(120),
      body: z.string().min(40, "Write at least a few sentences").max(12000),
      topic: z.enum(topics),
      contactEmail: z.string().email().max(200).optional().or(z.literal("")),
      adult: z.literal(true),
      website: z.string().max(0).optional(), // honeypot
    }),
  );
  const text = clean(input.body, 12000);
  if (moderateText(`${input.title} ${text}`).action === "block")
    throw bad("Some of this goes against our guidelines, so it can't be submitted.");
  const sql = await db();
  const [row] =
    await sql`insert into blog_posts (author_id, pen_name, title, body, topic, contact_email)
    values (${auth?.user.id ?? null}, ${clean(input.penName || "Anonymous", 40) || "Anonymous"}, ${clean(input.title, 120)}, ${text}, ${input.topic}, ${input.contactEmail || null})
    returning id`;
  const staff =
    await sql`select id from users where role in ('admin','moderator') and status = 'active'`;
  for (const s of staff)
    await notify(
      s["id"] as string,
      "moderation",
      "New blog piece to review",
      clean(input.title, 80),
      "/admin?tab=blog",
    );
  return { id: row!["id"], status: "pending" };
});

route("GET", "/admin/blog", async ({ request, url }) => {
  await requireStaff(request);
  const status = url.searchParams.get("status") ?? "pending";
  const sql = await db();
  const rows =
    await sql`select b.*, u.community_alias as submitted_by from blog_posts b left join users u on u.id = b.author_id
    where b.status = ${status} order by b.created_at desc limit 100`;
  return { posts: rows };
});

route("POST", "/admin/blog/:id", async ({ request, params }) => {
  const auth = await requireStaff(request);
  const input = await body(
    request,
    z.object({
      action: z.enum(["publish", "reject", "unpublish"]),
      note: z.string().max(500).optional(),
      title: z.string().min(3).max(120).optional(),
    }),
  );
  const sql = await db();
  const status =
    input.action === "publish" ? "published" : input.action === "reject" ? "rejected" : "pending";
  const [p] =
    await sql`update blog_posts set status = ${status}, review_note = ${input.note ?? ""}, reviewed_by = ${auth.user.id}, reviewed_at = now(),
      title = coalesce(${input.title ?? null}, title), published_at = case when ${status} = 'published' then coalesce(published_at, now()) else published_at end
    where id = ${params["id"]!} returning author_id, title`;
  if (!p) throw notFound();
  if (p["author_id"] && input.action !== "unpublish") {
    await notify(
      p["author_id"] as string,
      "community",
      input.action === "publish" ? "Your blog piece is live 🌷" : "About your blog piece",
      input.action === "publish"
        ? String(p["title"])
        : input.note || "It wasn't published this time — thank you for sharing it.",
      input.action === "publish" ? `/blog/${params["id"]}` : "/blog",
    );
  }
  await audit(auth.user.id, `blog.${input.action}`, params["id"]!, {}, clientIp(request));
  return { ok: true };
});
