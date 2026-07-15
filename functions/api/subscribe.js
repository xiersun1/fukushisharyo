import { checkRateLimit, getDb, writeAudit } from "../_shared/db.js";
import { sendEmail } from "../_shared/mailer.js";
import { confirmationEmail } from "../_shared/templates.js";
import {
  ConfigurationError,
  isSameOrigin,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  randomToken,
  readJson,
  sha256
} from "../_shared/utils.js";

const SUCCESS_MESSAGE = "確認メールを送信しました。メール内のリンクを押してください。";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return jsonResponse({ message: "送信元を確認できませんでした。" }, 403);

  try {
    const body = await readJson(request);
    if (body.company) return jsonResponse({ message: SUCCESS_MESSAGE });

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return jsonResponse({ message: "メールアドレスを確認してください。" }, 400);

    const db = await getDb(env);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await checkRateLimit(db, `subscribe:${ip}`, 5, 60 * 60 * 1000)) {
      return jsonResponse({ message: "登録操作が多すぎます。1時間ほど待ってからお試しください。" }, 429);
    }

    const existing = await db.prepare("SELECT id, status FROM subscribers WHERE email = ?").bind(email).first();
    if (existing?.status === "active") return jsonResponse({ message: SUCCESS_MESSAGE });

    if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new ConfigurationError("Mail is not configured");

    const token = randomToken();
    const tokenHash = await sha256(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();

    await db.prepare(`INSERT INTO subscribers (
      email, status, confirmation_token_hash, confirmation_expires_at, created_at, updated_at, source
    ) VALUES (?, 'pending', ?, ?, ?, ?, 'site')
    ON CONFLICT(email) DO UPDATE SET
      status = 'pending',
      confirmation_token_hash = excluded.confirmation_token_hash,
      confirmation_expires_at = excluded.confirmation_expires_at,
      unsubscribed_at = NULL,
      updated_at = excluded.updated_at`)
      .bind(email, tokenHash, expiresAt, now.toISOString(), now.toISOString()).run();

    const siteUrl = String(env.SITE_URL || new URL(request.url).origin).replace(/\/$/u, "");
    const confirmUrl = `${siteUrl}/api/confirm?token=${encodeURIComponent(token)}`;

    try {
      await sendEmail(env, { to: [email], ...confirmationEmail(confirmUrl) }, `confirm-${tokenHash}`);
      await writeAudit(db, "subscription_confirmation_sent", email);
    } catch (error) {
      await writeAudit(db, "subscription_confirmation_failed", email, String(error.message).slice(0, 500));
      throw error;
    }

    return jsonResponse({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error(error);
    if (error instanceof ConfigurationError) {
      return jsonResponse({ message: "現在メール登録の準備中です。設定完了後にお試しください。" }, 503);
    }
    return jsonResponse({ message: "確認メールを送信できませんでした。時間をおいて再度お試しください。" }, 502);
  }
}

