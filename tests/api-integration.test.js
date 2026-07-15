import assert from "node:assert/strict";
import test from "node:test";
import { createUnsubscribeToken } from "../functions/_shared/auth.js";
import { dispatchEligible } from "../functions/_shared/dispatch.js";
import { getDb } from "../functions/_shared/db.js";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { onRequestGet as subscribers } from "../functions/api/admin/subscribers.js";
import { onRequestGet as confirm } from "../functions/api/confirm.js";
import { onRequestPost as pageview } from "../functions/api/pageview.js";
import { onRequestPost as subscribe } from "../functions/api/subscribe.js";
import { onRequestPost as unsubscribe } from "../functions/api/unsubscribe.js";
import { FakeD1 } from "./helpers/fake-d1.js";

function createEnv() {
  return {
    SUBSCRIBERS_DB: new FakeD1(),
    RESEND_API_KEY: "re_test",
    MAIL_FROM: "福祉車両応募アラート <alert@notify.example.jp>",
    REPLY_TO: "contact@example.jp",
    SITE_URL: "https://example.jp",
    ADMIN_PASSWORD: "correct-password",
    ADMIN_SESSION_SECRET: "admin-session-secret-1234567890",
    TOKEN_SECRET: "unsubscribe-secret-1234567890",
    NOTIFY_WEBHOOK_SECRET: "webhook-secret-1234567890",
    NOTIFY_START_DATE: "2026-07-15",
    MAX_EMAILS_PER_DISPATCH: "90"
  };
}

function jsonRequest(url, body, extraHeaders = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(url).origin, ...extraHeaders },
    body: JSON.stringify(body)
  });
}

test("subscription, confirmation, page views, admin list and unsubscribe work together", async () => {
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  let confirmationPayload;
  globalThis.fetch = async (input, options = {}) => {
    if (String(input).startsWith("https://api.resend.com/emails")) {
      confirmationPayload = JSON.parse(options.body);
      return Response.json({ id: "email-confirm-1" });
    }
    return originalFetch(input, options);
  };

  try {
    const subscribeResponse = await subscribe({
      request: jsonRequest("https://example.jp/api/subscribe", { email: "User@Example.JP", company: "" }),
      env
    });
    assert.equal(subscribeResponse.status, 200);
    assert.equal(confirmationPayload.to[0], "user@example.jp");

    const confirmUrl = confirmationPayload.text.match(/https:\/\/[^\s]+/u)[0];
    const confirmResponse = await confirm({ request: new Request(confirmUrl), env });
    assert.equal(confirmResponse.status, 200);

    const db = await getDb(env);
    const active = await db.prepare("SELECT id, email, status FROM subscribers WHERE email = ?").bind("user@example.jp").first();
    assert.equal(active.status, "active");

    await pageview({ request: jsonRequest("https://example.jp/api/pageview", { path: "/" }), env });
    await pageview({ request: jsonRequest("https://example.jp/api/pageview", { path: "/" }), env });

    const loginResponse = await login({
      request: jsonRequest("https://example.jp/api/admin/login", { password: "correct-password" }),
      env
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

    const adminResponse = await subscribers({
      request: new Request("https://example.jp/api/admin/subscribers", { headers: { cookie } }),
      env
    });
    const adminData = await adminResponse.json();
    assert.equal(adminData.counts.active, 1);
    assert.equal(adminData.pageViews30Days, 2);
    assert.equal(adminData.subscribers[0].email, "user@example.jp");

    const token = await createUnsubscribeToken(active, env);
    const unsubscribeResponse = await unsubscribe({
      request: new Request(`https://example.jp/api/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "confirm=1"
      }),
      env
    });
    assert.equal(unsubscribeResponse.status, 200);
    const stopped = await db.prepare("SELECT status FROM subscribers WHERE id = ?").bind(active.id).first();
    assert.equal(stopped.status, "unsubscribed");
  } finally {
    globalThis.fetch = originalFetch;
    env.SUBSCRIBERS_DB.close();
  }
});

test("notice dispatch sends each active subscriber once", async () => {
  const env = createEnv();
  const db = await getDb(env);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO subscribers (email, status, created_at, confirmed_at, updated_at)
    VALUES (?, 'active', ?, ?, ?)`).bind("member@example.jp", now, now, now).run();

  const notice = {
    id: "new-notice-2026",
    publishedAt: "2026-07-15",
    title: "新しい福祉車両募集",
    org: "テスト財団",
    statusCode: "open",
    period: "2026年7月15日から8月1日",
    summary: "募集内容です。",
    detailUrl: "https://official.example.jp/notice"
  };

  const originalFetch = globalThis.fetch;
  let batchCalls = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url === "https://example.jp/data/sources.json") return Response.json({ notices: [notice] });
    if (url === "https://api.resend.com/emails/batch") {
      batchCalls += 1;
      const payload = JSON.parse(options.body);
      assert.equal(payload.length, 1);
      assert.equal(payload[0].to[0], "member@example.jp");
      return Response.json({ data: [{ id: "email-notice-1" }] });
    }
    return originalFetch(input, options);
  };

  try {
    const request = new Request("https://example.jp/api/dispatch", { method: "POST" });
    const first = await dispatchEligible({ request, env });
    const second = await dispatchEligible({ request, env });
    assert.equal(first[0].sentCount, 1);
    assert.equal(second[0].alreadyCompleted, true);
    assert.equal(batchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    env.SUBSCRIBERS_DB.close();
  }
});

