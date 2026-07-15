import { getDb } from "../_shared/db.js";
import { isSameOrigin, japanDate, readJson } from "../_shared/utils.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return new Response(null, { status: 204 });
  try {
    const body = await readJson(request, 1000);
    const path = String(body.path || "/").slice(0, 200);
    if (!path.startsWith("/")) return new Response(null, { status: 204 });
    const db = await getDb(env);
    await db.prepare(`INSERT INTO page_views (day, path, views) VALUES (?, ?, 1)
      ON CONFLICT(day, path) DO UPDATE SET views = views + 1`)
      .bind(japanDate(), path).run();
  } catch (error) {
    console.error(error);
  }
  return new Response(null, { status: 204 });
}

