import { escapeHtml } from "./utils.js";

function shell(content) {
  return `<!doctype html><html lang="ja"><body style="margin:0;background:#f6f7f9;color:#111827;font-family:Arial,'Yu Gothic','Meiryo',sans-serif;line-height:1.7"><div style="max-width:640px;margin:0 auto;padding:24px 16px"><div style="border:1px solid #d7dde6;background:#fff;padding:22px">${content}</div></div></body></html>`;
}

export function confirmationEmail(confirmUrl) {
  const safeUrl = escapeHtml(confirmUrl);
  return {
    subject: "【福祉車両応募アラート】メール登録の確認",
    html: shell(`<h1 style="font-size:20px;margin:0 0 16px">メール登録の確認</h1><p>次のボタンを押すと登録が完了します。</p><p style="margin:22px 0"><a href="${safeUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;text-decoration:none;font-weight:bold">登録を完了する</a></p><p style="font-size:13px;color:#5d6673">このリンクは24時間有効です。心当たりがない場合は何もする必要はありません。</p>`),
    text: `福祉車両応募アラートのメール登録を完了してください。\n${confirmUrl}\n\nこのリンクは24時間有効です。`
  };
}

export function noticeEmail(notice, unsubscribeUrl) {
  const safeDetailUrl = escapeHtml(notice.detailUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const subject = `【福祉車両応募アラート】${notice.title}`;
  return {
    subject,
    html: shell(`<p style="margin:0 0 8px;color:#5d6673">${escapeHtml(notice.org)}</p><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(notice.title)}</h1><div style="border:1px solid #d7dde6;background:#fafbfc;padding:12px"><strong>応募期間</strong><br>${escapeHtml(notice.period)}</div><p>${escapeHtml(notice.summary)}</p><p style="margin:22px 0"><a href="${safeDetailUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;text-decoration:none;font-weight:bold">公式の詳細を見る</a></p><hr style="border:0;border-top:1px solid #d7dde6;margin:24px 0"><p style="font-size:12px;color:#5d6673"><a href="${safeUnsubscribeUrl}">メール配信を停止する</a></p>`),
    text: `${notice.title}\n${notice.org}\n\n応募期間\n${notice.period}\n\n${notice.summary}\n\n詳細: ${notice.detailUrl}\n\n配信停止: ${unsubscribeUrl}`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    },
    tags: [{ name: "notice_id", value: String(notice.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 256) }]
  };
}

