import { ConfigurationError } from "./utils.js";

const API_BASE = "https://api.resend.com";

export function mailConfiguration(env) {
  return {
    ready: Boolean(env.RESEND_API_KEY && env.MAIL_FROM),
    from: env.MAIL_FROM || "",
    replyTo: env.REPLY_TO || ""
  };
}

function requireMail(env) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    throw new ConfigurationError("Missing RESEND_API_KEY or MAIL_FROM");
  }
}

async function resendRequest(env, path, body, idempotencyKey) {
  requireMail(env);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${result.message || result.name || "send failed"}`);
  }
  return result;
}

export function withSender(env, email) {
  return {
    from: env.MAIL_FROM,
    ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
    ...email
  };
}

export function sendEmail(env, email, idempotencyKey) {
  return resendRequest(env, "/emails", withSender(env, email), idempotencyKey);
}

export function sendBatchEmails(env, emails, idempotencyKey) {
  if (emails.length === 0) return Promise.resolve({ data: [] });
  return resendRequest(env, "/emails/batch", emails.map((email) => withSender(env, email)), idempotencyKey);
}

