import { createUnsubscribeToken } from "./auth.js";
import { getDb } from "./db.js";
import { sendBatchEmails } from "./mailer.js";
import { noticeEmail } from "./templates.js";
import { sha256 } from "./utils.js";

function rows(result) {
  return result?.results || [];
}

export async function loadNotices(request) {
  const url = new URL("/data/sources.json", request.url);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Notice data returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.notices)) throw new Error("Notice data is invalid");
  return data.notices;
}

function dispatchLimit(env) {
  const value = Number(env.MAX_EMAILS_PER_DISPATCH || 90);
  return Math.max(1, Math.min(100, Number.isFinite(value) ? value : 90));
}

async function campaignStats(db, noticeId) {
  const recipients = await db.prepare("SELECT COUNT(*) AS count FROM subscribers WHERE status = 'active'").first();
  const deliveries = await db.prepare(`SELECT
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM deliveries WHERE notice_id = ?`).bind(noticeId).first();
  const recipientCount = Number(recipients?.count || 0);
  const sentCount = Number(deliveries?.sent || 0);
  const failedCount = Number(deliveries?.failed || 0);
  return {
    recipientCount,
    sentCount,
    failedCount,
    complete: sentCount >= recipientCount
  };
}

async function updateCampaign(db, notice, stats) {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO campaigns (
      notice_id, title, started_at, completed_at, recipient_count, sent_count, failed_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(notice_id) DO UPDATE SET
      title = excluded.title,
      completed_at = excluded.completed_at,
      recipient_count = excluded.recipient_count,
      sent_count = excluded.sent_count,
      failed_count = excluded.failed_count`)
    .bind(
      notice.id,
      notice.title,
      now,
      stats.complete ? now : null,
      stats.recipientCount,
      stats.sentCount,
      stats.failedCount
    ).run();
}

export async function dispatchNotice({ request, env, notice }) {
  const db = await getDb(env);
  const existingCampaign = await db.prepare("SELECT completed_at FROM campaigns WHERE notice_id = ?").bind(notice.id).first();
  if (existingCampaign?.completed_at) {
    const stats = await campaignStats(db, notice.id);
    return { noticeId: notice.id, title: notice.title, alreadyCompleted: true, batchSent: 0, ...stats };
  }

  const pending = rows(await db.prepare(`SELECT s.id, s.email
    FROM subscribers s
    WHERE s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM deliveries d
        WHERE d.notice_id = ? AND d.subscriber_id = s.id AND d.status = 'sent'
      )
    ORDER BY s.id ASC
    LIMIT ?`).bind(notice.id, dispatchLimit(env)).all());

  if (pending.length === 0) {
    const stats = await campaignStats(db, notice.id);
    await updateCampaign(db, notice, stats);
    return { noticeId: notice.id, title: notice.title, batchSent: 0, ...stats };
  }

  const now = new Date().toISOString();
  await db.batch(pending.map((subscriber) => db.prepare(`INSERT INTO deliveries (
      notice_id, subscriber_id, status, updated_at
    ) VALUES (?, ?, 'queued', ?)
    ON CONFLICT(notice_id, subscriber_id) DO UPDATE SET
      status = 'queued', error = NULL, updated_at = excluded.updated_at`)
    .bind(notice.id, subscriber.id, now)));

  const siteUrl = String(env.SITE_URL || new URL(request.url).origin).replace(/\/$/u, "");
  const emails = [];
  for (const subscriber of pending) {
    const unsubscribeToken = await createUnsubscribeToken(subscriber, env);
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    emails.push({ to: [subscriber.email], ...noticeEmail(notice, unsubscribeUrl) });
  }

  try {
    const idempotencyKey = `notice-${(await sha256(`${notice.id}:${pending[0].id}`)).slice(0, 40)}`;
    const result = await sendBatchEmails(env, emails, idempotencyKey);
    const providerRows = Array.isArray(result.data) ? result.data : [];
    const sentAt = new Date().toISOString();
    await db.batch(pending.map((subscriber, index) => db.prepare(`UPDATE deliveries SET
      status = 'sent', provider_id = ?, sent_at = ?, error = NULL, updated_at = ?
      WHERE notice_id = ? AND subscriber_id = ?`)
      .bind(providerRows[index]?.id || null, sentAt, sentAt, notice.id, subscriber.id)));
  } catch (error) {
    const failedAt = new Date().toISOString();
    await db.batch(pending.map((subscriber) => db.prepare(`UPDATE deliveries SET
      status = 'failed', error = ?, updated_at = ? WHERE notice_id = ? AND subscriber_id = ?`)
      .bind(String(error.message).slice(0, 500), failedAt, notice.id, subscriber.id)));
    const stats = await campaignStats(db, notice.id);
    await updateCampaign(db, notice, stats);
    throw error;
  }

  const stats = await campaignStats(db, notice.id);
  await updateCampaign(db, notice, stats);
  return { noticeId: notice.id, title: notice.title, batchSent: pending.length, ...stats };
}

export async function dispatchEligible({ request, env, noticeId = null }) {
  const notices = await loadNotices(request);
  if (noticeId) {
    const notice = notices.find((item) => item.id === noticeId);
    if (!notice) throw new Error("指定したお知らせが見つかりません。");
    return [await dispatchNotice({ request, env, notice })];
  }

  const startDate = env.NOTIFY_START_DATE || new Date().toISOString().slice(0, 10);
  const candidates = notices
    .filter((notice) => ["open", "upcoming"].includes(notice.statusCode) && notice.publishedAt >= startDate)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 3);

  const results = [];
  for (const notice of candidates) {
    results.push(await dispatchNotice({ request, env, notice }));
  }
  return results;
}

