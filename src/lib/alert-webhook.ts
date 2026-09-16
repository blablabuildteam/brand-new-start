/**
 * Outbound alert webhooks (Slack Incoming Webhooks + Discord).
 * Dual payload: Slack reads `text`, Discord reads `content`.
 */

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
}

export function absoluteAppUrl(href?: string | null): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//i.test(href)) return href;
  const origin = appOrigin();
  if (!origin) return href;
  return `${origin}${href.startsWith("/") ? href : `/${href}`}`;
}

export function alertWebhookBody(opts: {
  title: string;
  body: string;
  href?: string | null;
}): { text: string; content: string } {
  const link = absoluteAppUrl(opts.href);
  const message = `*${opts.title}*\n${opts.body}${link ? `\n${link}` : ""}`;
  // Discord ignores Slack mrkdwn *; plain content still readable.
  const plain = `${opts.title}\n${opts.body}${link ? `\n${link}` : ""}`;
  return { text: message, content: plain };
}

export async function postAlertWebhook(opts: {
  title: string;
  body: string;
  href?: string | null;
}): Promise<void> {
  const hook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!hook) return;
  const payload = alertWebhookBody(opts);
  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[alert-webhook]", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.warn("[alert-webhook]", err instanceof Error ? err.message : err);
  }
}
