import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/lib/prisma-bio-client";
import { cryptoPrisma } from "@/lib/crypto-db";
import { isValidCnpjDigits, normalizeCnpjDigits } from "@/lib/cnpj";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { sendEmail } from "@/lib/mailer";
import { emailSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60_000;
const MAX_RAZAO = 300;
const MAX_RESP = 200;
const MAX_SITE_URL = 2048;
const MAX_TAX_ID = 200;

function normalizeSiteUrl(raw: string): { ok: true; value: string } | { ok: false } {
  const s = raw.trim();
  if (!s) return { ok: false };
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
    const href = u.href;
    if (href.length > MAX_SITE_URL) return { ok: false };
    return { ok: true, value: href };
  } catch {
    return { ok: false };
  }
}

function newIdAfiliado(): string {
  return `AFF-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function isValidTaxIdEn(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 4 || s.length > MAX_TAX_ID) return false;
  if (s.replace(/\s/g, "").length < 4) return false;
  return true;
}

export async function POST(req: Request) {
  const { ok: ipOk, retryAfter } = rateLimit(clientKeyFromRequest(req, "affiliate-signup"), RATE_LIMIT, RATE_WINDOW_MS);
  if (!ipOk) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfter / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const cnpjRaw = typeof b.cnpj === "string" ? b.cnpj : "";
  const razaoSocialRaw = typeof b.razaoSocial === "string" ? b.razaoSocial : "";
  const taxIdRaw = typeof b.taxId === "string" ? b.taxId : "";
  const responsavelRaw = typeof b.responsavel === "string" ? b.responsavel : "";
  const emailRaw = typeof b.email === "string" ? b.email : "";
  const siteUrlRaw = typeof b.siteUrl === "string" ? b.siteUrl : typeof b.url === "string" ? b.url : "";
  const acceptedDocs = b.acceptedDocs === true;
  const localeRaw = b.locale === "en" ? "en" : "pt";

  const responsavel = responsavelRaw.trim().slice(0, MAX_RESP);

  const emailParsed = emailSchema.safeParse(emailRaw);
  if (!emailParsed.success) {
    return NextResponse.json({ error: "validation", code: "email" }, { status: 400 });
  }
  const email = emailParsed.data;

  const urlNorm = normalizeSiteUrl(siteUrlRaw);
  if (!urlNorm.ok) {
    return NextResponse.json({ error: "validation", code: "url" }, { status: 400 });
  }
  const siteUrl = urlNorm.value;

  if (!acceptedDocs || !responsavel) {
    return NextResponse.json({ error: "validation", code: "required" }, { status: 400 });
  }

  let cnpjDigits: string | null = null;
  let taxId: string | null = null;
  let razaoSocial: string;

  if (localeRaw === "en") {
    razaoSocial = razaoSocialRaw.trim().slice(0, MAX_RAZAO);
    if (!razaoSocial) {
      return NextResponse.json({ error: "validation", code: "required" }, { status: 400 });
    }
    const tax = taxIdRaw.trim().slice(0, MAX_TAX_ID);
    if (!isValidTaxIdEn(tax)) {
      return NextResponse.json({ error: "validation", code: "taxId" }, { status: 400 });
    }
    taxId = tax;
  } else {
    const digits = normalizeCnpjDigits(cnpjRaw);
    razaoSocial = razaoSocialRaw.trim().slice(0, MAX_RAZAO);
    if (!razaoSocial) {
      return NextResponse.json({ error: "validation", code: "required" }, { status: 400 });
    }
    if (digits.length !== 14 || !isValidCnpjDigits(digits)) {
      return NextResponse.json({ error: "validation", code: "cnpj" }, { status: 400 });
    }
    cnpjDigits = digits;
  }

  const existingByEmail = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingByEmail) {
    return NextResponse.json({ error: "validation", code: "email_unique" }, { status: 409 });
  }

  let row: { idAfiliado: string } | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const idAfiliado = newIdAfiliado();
    try {
      row = await cryptoPrisma.affiliateApplication.create({
        data: {
          idAfiliado,
          cnpjDigits,
          taxId,
          razaoSocial,
          responsavel,
          email,
          siteUrl,
          acceptedDocs: true,
          locale: localeRaw,
        },
        select: { idAfiliado: true },
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta as { target?: string[] })?.target;
        if (Array.isArray(target) && target.includes("email")) {
          return NextResponse.json({ error: "validation", code: "email_unique" }, { status: 409 });
        }
        continue;
      }
      console.error("[affiliate-signup]", e);
      return NextResponse.json({ error: "server" }, { status: 500 });
    }
  }
  if (!row) {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const notify = process.env.AFFILIATE_NOTIFY_EMAIL?.trim();
  if (notify && process.env.RESEND_API_KEY) {
    try {
      const lines =
        localeRaw === "en"
          ? [
              `id_afiliado: ${row.idAfiliado}`,
              `Legal company name: ${razaoSocial}`,
              `Tax ID / business registration: ${taxId}`,
              `CNPJ (BR): —`,
              `Responsável: ${responsavel}`,
              `E-mail: ${email}`,
              `URL: ${siteUrl}`,
              `Locale: ${localeRaw}`,
            ]
          : [
              `id_afiliado: ${row.idAfiliado}`,
              `CNPJ: ${cnpjDigits}`,
              `Tax ID: —`,
              `Razão social: ${razaoSocial}`,
              `Responsável: ${responsavel}`,
              `E-mail: ${email}`,
              `URL: ${siteUrl}`,
              `Locale: ${localeRaw}`,
            ];
      await sendEmail({
        to: notify,
        subject: `[Afiliado] Nova inscrição ${row.idAfiliado}`,
        text: lines.join("\n"),
      });
    } catch (err) {
      console.warn("[affiliate-signup] notify email failed", err);
    }
  }

  return NextResponse.json({ idAfiliado: row.idAfiliado });
}
