import { verifyUnsubscribeToken } from "../_shared/auth.js";
import { getDb, writeAudit } from "../_shared/db.js";
import { escapeHtml, htmlResponse, pageDocument } from "../_shared/utils.js";

function unsubscribePage(token) {
  return pageDocument("メール配信の停止", `<h1>メール配信の停止</h1><p>福祉車両応募アラートのメール配信を停止します。</p><form method="post" action="/api/unsubscribe?token=${escapeHtml(encodeURIComponent(token))}"><input type="hidden" name="confirm" value="1"><button type="submit">配信を停止する</button></form><p><a href="/">戻る</a></p>`);
}

function completedPage() {
  return pageDocument("配信を停止しました", `<h1>配信を停止しました</h1><p>このメールアドレスへの通知を停止しました。</p><p><a href="/">福祉車両応募アラートへ戻る</a></p>`);
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const payload = await verifyUnsubscribeToken(token, env);
  if (!payload) return htmlResponse(pageDocument("確認できませんでした", "<h1>確認できませんでした</h1><p>配信停止リンクが正しくありません。</p>"), 400);
  return htmlResponse(unsubscribePage(token));
}

export async function onRequestPost({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const payload = await verifyUnsubscribeToken(token, env);
    if (!payload) return new Response("", { status: 400 });

    const body = await request.text();
    const db = await getDb(env);
    const now = new Date().toISOString();
    await db.prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ?, updated_at = ?
      WHERE id = ? AND email = ?`).bind(now, now, payload.id, payload.email).run();
    await writeAudit(db, "subscription_unsubscribed", payload.email);

    if (body.includes("List-Unsubscribe=One-Click")) return new Response("", { status: 200 });
    return htmlResponse(completedPage());
  } catch (error) {
    console.error(error);
    return new Response("", { status: 500 });
  }
}

