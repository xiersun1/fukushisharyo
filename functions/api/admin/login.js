import { createAdminCookie, passwordMatches } from "../../_shared/auth.js";
import { checkRateLimit, getDb, writeAudit } from "../../_shared/db.js";
import { ConfigurationError, isSameOrigin, jsonResponse, readJson } from "../../_shared/utils.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return jsonResponse({ message: "ログインできませんでした。" }, 403);
  try {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) throw new ConfigurationError("Admin is not configured");
    const db = await getDb(env);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await checkRateLimit(db, `admin-login:${ip}`, 10, 60 * 60 * 1000)) {
      return jsonResponse({ message: "ログイン操作が多すぎます。1時間ほど待ってください。" }, 429);
    }
    const body = await readJson(request);
    if (!await passwordMatches(body.password, env)) {
      await writeAudit(db, "admin_login_failed", ip);
      return jsonResponse({ message: "パスワードが違います。" }, 401);
    }
    await writeAudit(db, "admin_login_success", ip);
    return jsonResponse({ ok: true }, 200, { "set-cookie": await createAdminCookie(env) });
  } catch (error) {
    console.error(error);
    return jsonResponse({ message: "管理画面の設定が完了していません。" }, 503);
  }
}

