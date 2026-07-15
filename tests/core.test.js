import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SCHEMA } from "../functions/_shared/db.js";
import { noticeEmail } from "../functions/_shared/templates.js";
import {
  constantTimeEqual,
  isValidEmail,
  normalizeEmail,
  signObject,
  verifySignedObject
} from "../functions/_shared/utils.js";

test("email values are normalized and validated", () => {
  assert.equal(normalizeEmail(" User@Example.JP "), "user@example.jp");
  assert.equal(isValidEmail("user@example.jp"), true);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("signed tokens reject modified values", async () => {
  const token = await signObject({ id: 12, email: "user@example.jp" }, "test-secret");
  assert.deepEqual(await verifySignedObject(token, "test-secret"), { id: 12, email: "user@example.jp" });
  assert.equal(await verifySignedObject(`${token}x`, "test-secret"), null);
  assert.equal(constantTimeEqual("same", "same"), true);
  assert.equal(constantTimeEqual("same", "different"), false);
});

test("notification content escapes data and includes unsubscribe headers", () => {
  const email = noticeEmail({
    id: "notice-1",
    title: "<script>alert(1)</script>",
    org: "団体",
    period: "2026年7月",
    summary: "概要",
    detailUrl: "https://example.jp/detail"
  }, "https://example.jp/unsubscribe?token=abc");
  assert.equal(email.html.includes("<script>alert(1)</script>"), false);
  assert.equal(email.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("schema and public client contain the operational features", async () => {
  const app = await readFile(new URL("../src/assets/app.js", import.meta.url), "utf8");
  assert.equal(SCHEMA.some((statement) => statement.includes("CREATE TABLE IF NOT EXISTS subscribers")), true);
  assert.equal(app.includes('fetch("/api/subscribe"'), true);
  assert.equal(app.includes('fetch("/api/pageview"'), true);
  assert.equal(app.includes("localStorage.setItem"), false);
});

