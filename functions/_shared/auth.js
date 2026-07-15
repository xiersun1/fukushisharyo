import { constantTimeEqual, parseCookies, sha256, signObject, verifySignedObject } from "./utils.js";

const COOKIE_NAME = "fukushi_alert_admin";
const SESSION_SECONDS = 8 * 60 * 60;

export async function passwordMatches(password, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const [provided, expected] = await Promise.all([
    sha256(String(password || "")),
    sha256(env.ADMIN_PASSWORD)
  ]);
  return constantTimeEqual(provided, expected);
}

export async function createAdminCookie(env) {
  const token = await signObject({ role: "admin", exp: Date.now() + (SESSION_SECONDS * 1000) }, env.ADMIN_SESSION_SECRET);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function isAdmin(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  const payload = await verifySignedObject(token, env.ADMIN_SESSION_SECRET);
  return payload?.role === "admin" && Number(payload.exp) > Date.now();
}

export async function createUnsubscribeToken(subscriber, env) {
  return signObject({ id: subscriber.id, email: subscriber.email, version: 1 }, env.TOKEN_SECRET);
}

export async function verifyUnsubscribeToken(token, env) {
  const payload = await verifySignedObject(token, env.TOKEN_SECRET);
  if (!payload || !Number.isInteger(Number(payload.id)) || typeof payload.email !== "string") return null;
  return { id: Number(payload.id), email: payload.email };
}

