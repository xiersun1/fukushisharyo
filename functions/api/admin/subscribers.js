import { isAdmin } from "../../_shared/auth.js";
import { getDb } from "../../_shared/db.js";
import { mailConfiguration } from "../../_shared/mailer.js";
import { japanDate, jsonResponse } from "../../_shared/utils.js";

function rows(result) {
  return result?.results || [];
}

export async function onRequestGet({ request, env }) {
  if (!await isAdmin(request, env)) return jsonResponse({ message: "ログインが必要です。" }, 401);
  try {
    const db = await getDb(env);
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startDay = japanDate(start);

    const [countRows, subscriberRows, viewTotal, dailyViews, campaigns] = await Promise.all([
      db.prepare("SELECT status, COUNT(*) AS count FROM subscribers GROUP BY status").all(),
      db.prepare(`SELECT id, email, status, created_at, confirmed_at, unsubscribed_at
        FROM subscribers ORDER BY created_at DESC LIMIT 1000`).all(),
      db.prepare("SELECT COALESCE(SUM(views), 0) AS count FROM page_views WHERE day >= ?").bind(startDay).first(),
      db.prepare("SELECT day, SUM(views) AS views FROM page_views WHERE day >= ? GROUP BY day ORDER BY day DESC").bind(startDay).all(),
      db.prepare(`SELECT notice_id, title, started_at, completed_at, recipient_count, sent_count, failed_count
        FROM campaigns ORDER BY started_at DESC LIMIT 50`).all()
    ]);

    const counts = { active: 0, pending: 0, unsubscribed: 0 };
    for (const item of rows(countRows)) counts[item.status] = Number(item.count || 0);

    return jsonResponse({
      counts,
      pageViews30Days: Number(viewTotal?.count || 0),
      dailyViews: rows(dailyViews),
      subscribers: rows(subscriberRows),
      campaigns: rows(campaigns),
      configuration: {
        ...mailConfiguration(env),
        notifyStartDate: env.NOTIFY_START_DATE || null
      }
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ message: "管理データを読み込めませんでした。" }, 500);
  }
}

