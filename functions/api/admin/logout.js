import { clearAdminCookie } from "../../_shared/auth.js";
import { isSameOrigin, jsonResponse } from "../../_shared/utils.js";

export function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return jsonResponse({ message: "ログアウトできませんでした。" }, 403);
  return jsonResponse({ ok: true }, 200, { "set-cookie": clearAdminCookie() });
}

