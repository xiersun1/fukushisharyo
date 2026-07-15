import { isAdmin } from "../../_shared/auth.js";
import { dispatchEligible } from "../../_shared/dispatch.js";
import { isSameOrigin, jsonResponse, readJson } from "../../_shared/utils.js";

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return jsonResponse({ message: "送信元を確認できませんでした。" }, 403);
  if (!await isAdmin(request, env)) return jsonResponse({ message: "ログインが必要です。" }, 401);
  try {
    const body = await readJson(request);
    if (!body.noticeId) return jsonResponse({ message: "お知らせを選択してください。" }, 400);
    const results = await dispatchEligible({ request, env, noticeId: body.noticeId });
    return jsonResponse({ ok: true, results });
  } catch (error) {
    console.error(error);
    return jsonResponse({ message: error.message || "通知を送信できませんでした。" }, 500);
  }
}

