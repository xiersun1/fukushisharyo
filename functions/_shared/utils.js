export class ConfigurationError extends Error {}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function readJson(request, maxLength = 10000) {
  const text = await request.text();
  if (text.length > maxLength) throw new Error("Request body is too large");
  return text ? JSON.parse(text) : {};
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function randomToken(bytes = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

export function base64UrlToString(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function signObject(payload, secret) {
  if (!secret) throw new ConfigurationError("Missing token secret");
  const encoded = stringToBase64Url(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

export async function verifySignedObject(token, secret) {
  if (!token || !secret) return null;
  const [encoded, providedSignature, extra] = String(token).split(".");
  if (!encoded || !providedSignature || extra) return null;
  const expectedSignature = await hmac(encoded, secret);
  if (!constantTimeEqual(providedSignature, expectedSignature)) return null;
  try {
    return JSON.parse(base64UrlToString(encoded));
  } catch {
    return null;
  }
}

export function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.length] || 0) ^ (b[index % b.length] || 0);
  }
  return difference === 0;
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(header.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [part.trim(), ""];
    return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1))];
  }).filter(([key]) => key));
}

export function japanDate(date = new Date()) {
  return new Date(date.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

export function pageDocument(title, body) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;background:#f6f7f9;color:#111827;font-family:"Yu Gothic","Meiryo",sans-serif;line-height:1.7}
    main{width:min(680px,calc(100% - 28px));margin:48px auto;padding:22px;border:1px solid #d7dde6;background:#fff}
    h1{margin:0 0 14px;font-size:1.45rem}a{color:#136f63;font-weight:700}button{min-height:42px;padding:7px 14px;border:0;background:#111827;color:#fff;font:inherit;font-weight:700;cursor:pointer}
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

