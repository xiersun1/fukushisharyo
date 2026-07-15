import { getDb, writeAudit } from "../_shared/db.js";
import { escapeHtml, htmlResponse, pageDocument, sha256 } from "../_shared/utils.js";

function resultPage(title, message) {
  return pageDocument(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">福祉車両応募アラートへ戻る</a></p>`);
}

export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    if (token.length < 20) return htmlResponse(resultPage("確認できませんでした", "確認リンクが正しくありません。"), 400);

    const db = await getDb(env);
    const tokenHash = await sha256(token);
    const subscriber = await db.prepare(`SELECT id, email, status, confirmation_expires_at
      FROM subscribers WHERE confirmation_token_hash = ?`).bind(tokenHash).first();

    if (!subscriber || subscriber.status !== "pending" || subscriber.confirmation_expires_at <= new Date().toISOString()) {
      return htmlResponse(resultPage("確認できませんでした", "確認リンクの有効期限が切れているか、すでに使用されています。"), 400);
    }

    const now = new Date().toISOString();
    await db.prepare(`UPDATE subscribers SET
      status = 'active', confirmed_at = ?, confirmation_token_hash = NULL,
      confirmation_expires_at = NULL, updated_at = ? WHERE id = ?`)
      .bind(now, now, subscriber.id).run();
    await writeAudit(db, "subscription_confirmed", subscriber.email);

    return htmlResponse(resultPage("メール登録が完了しました", "新しい応募情報をメールでお知らせします。"));
  } catch (error) {
    console.error(error);
    return htmlResponse(resultPage("確認できませんでした", "時間をおいて再度お試しください。"), 500);
  }
}

