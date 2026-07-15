import { isAdmin } from "../../_shared/auth.js";
import { getDb } from "../../_shared/db.js";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function onRequestGet({ request, env }) {
  if (!await isAdmin(request, env)) return new Response("Unauthorized", { status: 401 });
  const db = await getDb(env);
  const result = await db.prepare(`SELECT email, status, created_at, confirmed_at, unsubscribed_at
    FROM subscribers ORDER BY created_at DESC`).all();
  const lines = [
    ["メールアドレス", "状態", "登録日時", "確認日時", "解除日時"],
    ...(result.results || []).map((item) => [item.email, item.status, item.created_at, item.confirmed_at, item.unsubscribed_at])
  ];
  const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=UTF-8",
      "content-disposition": "attachment; filename=subscribers.csv",
      "cache-control": "no-store"
    }
  });
}

