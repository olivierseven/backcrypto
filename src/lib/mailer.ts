import { Resend } from "resend";

const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  process.env.EMAIL_FROM ||
  "SevenCoins <no-reply@sevencoins.com.br>";
const DEFAULT_REPLY_TO = process.env.MAIL_REPLY_TO || undefined;

if (!process.env.RESEND_API_KEY) {
  console.warn("[mailer] RESEND_API_KEY ausente. Envio real não funcionará.");
}
const resend = new Resend(process.env.RESEND_API_KEY!);

type Address = string | { name?: string; email: string };

function formatAddress(addr?: Address): string | undefined {
  if (!addr) return undefined;
  if (typeof addr === "string") return addr;
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

function toArray<T>(v?: T | T[]): T[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? (v.length ? v : undefined) : [v];
}

function absoluteUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/+$/, "");
  const rel = pathOrUrl.replace(/^\/+/, "");
  return `${base}/${rel}`;
}

export async function sendEmail(args: {
  to: Address | Address[];
  subject: string;
  html?: string;
  text?: string;
  from?: Address;
  replyTo?: Address;
}) {
  const { to, subject, html, text, from, replyTo } = args;
  const toList = toArray(to)?.map(formatAddress).filter(Boolean) as string[] | undefined;
  if (!toList?.length) throw new Error("[mailer] Missing 'to'");
  const fromStr = formatAddress(from) || DEFAULT_FROM;
  const replyToStr = formatAddress(replyTo) || DEFAULT_REPLY_TO;
  const textBody = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined);
  if (!html && !textBody) throw new Error("[mailer] Provide at least 'html' or 'text'");
  const payload: any = {
    from: fromStr,
    to: toList.length === 1 ? toList[0] : toList,
    subject,
    ...(replyToStr ? { replyTo: replyToStr } : {}),
  };
  if (html) payload.html = html;
  if (textBody) payload.text = textBody;

  console.info("[mailer] sendEmail →", { to: toList, subject, from: fromStr });
  const res = await resend.emails.send(payload);
  logResendResponse(res);
  return res;
}

function logResendResponse(res: unknown) {
  try {
    const r = res as { data?: { id?: string }; error?: { message?: string }; id?: string };
    if (r?.error) {
      console.error("[mailer] Resend error:", r.error?.message ?? JSON.stringify(r.error));
    } else {
      const id = r?.data?.id ?? r?.id;
      console.info("[mailer] Resend OK, id:", id ?? "(no id)");
    }
  } catch {
    // ignore
  }
}

function renderVerificationEmailHTML(url: string, expiresMin: number) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;padding:8px">
    <h1 style="margin:0 0 12px;font-size:22px">Confirme seu e-mail</h1>
    <p style="margin:0 0 12px">Clique no botão para confirmar seu cadastro. O link expira em ${expiresMin} minutos.</p>
    <p style="margin:18px 0">
      <a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111;color:#fff;text-decoration:none">
        Confirmar e-mail
      </a>
    </p>
    <p style="margin:18px 0 0;font-size:13px;color:#555">Se o botão não funcionar, copie e cole esta URL no navegador:</p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;word-break:break-all">${url}</p>
  </div>`;
}

function renderVerificationEmailText(url: string, expiresMin: number) {
  return [
    "Confirme seu e-mail",
    "",
    `Clique no link para confirmar seu cadastro. O link expira em ${expiresMin} minutos.`,
    url,
  ].join("\n");
}

/**
 * Envia e-mail de verificação de endereço (cadastro Bio).
 * baseUrl: origem do app Bio (ex.: http://localhost:3004) para montar o link.
 */
export async function sendVerificationEmail(args: {
  to: Address;
  token: string;
  baseUrl: string;
  verifyPath?: string;
  expiresMinutes?: number;
  from?: Address;
  replyTo?: Address;
}) {
  const {
    to,
    token,
    baseUrl,
    verifyPath = `/api/auth/verify?token=${encodeURIComponent(token)}`,
    expiresMinutes = 30,
    from,
    replyTo,
  } = args;
  const url = absoluteUrl(baseUrl, verifyPath);
  return sendEmail({
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo ?? DEFAULT_REPLY_TO,
    to,
    subject: "Verifique seu e-mail",
    html: renderVerificationEmailHTML(url, expiresMinutes),
    text: renderVerificationEmailText(url, expiresMinutes),
  });
}

function renderPasswordResetEmailHTML(resetUrl: string, expiresMin: number) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;padding:8px">
    <h1 style="margin:0 0 12px;font-size:22px">Redefinir senha</h1>
    <p style="margin:0 0 12px">Você pediu para redefinir sua senha. Clique no botão abaixo. O link expira em ${expiresMin} minutos.</p>
    <p style="margin:18px 0">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111;color:#fff;text-decoration:none">
        Redefinir senha
      </a>
    </p>
    <p style="margin:18px 0 0;font-size:13px;color:#555">Se você não pediu isso, ignore este e-mail.</p>
    <p style="margin:18px 0 0;font-size:13px;color:#555">Se o botão não funcionar, copie e cole esta URL no navegador:</p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;word-break:break-all">${resetUrl}</p>
  </div>`;
}

function renderPasswordResetEmailText(resetUrl: string, expiresMin: number) {
  return [
    "Redefinir senha",
    "",
    `Você pediu para redefinir sua senha. Acesse o link abaixo. O link expira em ${expiresMin} minutos.`,
    resetUrl,
    "",
    "Se você não pediu isso, ignore este e-mail.",
  ].join("\n");
}

/**
 * Envia e-mail com link para redefinir senha (Bio).
 * baseUrl: origem do app (ex.: https://sevencoins.com.br); resetPath deve incluir basePath (ex.: /crypto/reset-password).
 */
export async function sendPasswordResetEmail(args: {
  to: Address;
  token: string;
  baseUrl: string;
  resetPath?: string;
  expiresMinutes?: number;
  from?: Address;
  replyTo?: Address;
}) {
  const {
    to,
    token,
    baseUrl,
    resetPath = `/crypto/reset-password?token=${encodeURIComponent(token)}`,
    expiresMinutes = 30,
    from,
    replyTo,
  } = args;
  const url = absoluteUrl(baseUrl, resetPath);
  return sendEmail({
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo ?? DEFAULT_REPLY_TO,
    to,
    subject: "Redefinir senha",
    html: renderPasswordResetEmailHTML(url, expiresMinutes),
    text: renderPasswordResetEmailText(url, expiresMinutes),
  });
}
