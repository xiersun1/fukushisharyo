import { jsonResponse } from "../_shared/utils.js";

export function onRequestGet({ env }) {
  return jsonResponse({
    database: Boolean(env.SUBSCRIBERS_DB),
    mail: Boolean(env.RESEND_API_KEY && env.MAIL_FROM),
    admin: Boolean(env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET),
    sender: env.MAIL_FROM || null
  });
}

