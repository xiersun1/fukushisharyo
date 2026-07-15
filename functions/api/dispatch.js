import { dispatchEligible } from "../_shared/dispatch.js";
import { constantTimeEqual, jsonResponse, readJson } from "../_shared/utils.js";

export async function onRequestPost({ request, env }) {
  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${env.NOTIFY_WEBHOOK_SECRET || ""}`;
  if (!env.NOTIFY_WEBHOOK_SECRET || !constantTimeEqual(authorization, expected)) {
    return jsonResponse({ message: "Unauthorized" }, 401);
  }
  try {
    const body = await readJson(request).catch(() => ({}));
    const results = await dispatchEligible({ request, env, noticeId: body.noticeId || null });
    return jsonResponse({ ok: true, results });
  } catch (error) {
    console.error(error);
    return jsonResponse({ message: error.message || "Dispatch failed" }, 500);
  }
}

