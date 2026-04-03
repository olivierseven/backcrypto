import { NextResponse } from "next/server";
import { getAffiliateSessionFromCookie } from "@/lib/affiliate-jwt-server";
import { resolveAffiliateApplicationIdAfiliadoByAccountId } from "@/lib/affiliate-coupon-plan";
import { isAffiliateAccountingAdminEmail } from "@/lib/affiliate-accounting-admin";
import { cryptoPrisma } from "@/lib/crypto-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove apenas caracteres inválidos em nomes de ficheiro; mantém espaços, acentos e parênteses. */
function sanitizeFilenameForDownload(name: string): string {
  let s = name.replace(/[\r\n\0]/g, "").replace(/[/\\:*?"<>|]/g, "_").trim();
  if (!/\.pdf$/i.test(s)) {
    s = s.replace(/\.+$/, "") + ".pdf";
  }
  return s.slice(0, 240);
}

/**
 * `filename` legado (só ASCII) para clients antigos; o nome completo vai em `filename*` (UTF-8, RFC 5987).
 */
function legacyAsciiFilenameHint(utf8Name: string, fallback: string): string {
  let out = "";
  for (const ch of utf8Name) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c <= 0x7e && ch !== '"' && ch !== "\\") {
      out += ch;
    } else {
      out += "_";
    }
  }
  out = out.replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 180);
  if (!out.toLowerCase().endsWith(".pdf")) {
    out = (out.replace(/\.+$/, "") || "invoice") + ".pdf";
  }
  return out || fallback;
}

function contentDispositionAttachment(original: string | null, fallback: string): string {
  const base = (original?.trim() || "").length ? original!.trim() : fallback;
  const utf8 = sanitizeFilenameForDownload(base);
  const ascii = legacyAsciiFilenameHint(utf8, fallback);
  const star = encodeURIComponent(utf8);
  return `attachment; filename="${ascii.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"; filename*=UTF-8''${star}`;
}

/**
 * GET: PDF da NF (`AffiliateMonthAggInvoice`) para o dono do mês ou admin de contabilidade.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ monthAggId: string }> },
) {
  const { monthAggId } = await context.params;
  if (!monthAggId) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const session = await getAffiliateSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const idAfiliadoPublic =
    (await resolveAffiliateApplicationIdAfiliadoByAccountId(session.accountId)) ?? "";
  const isAdmin = await isAffiliateAccountingAdminEmail(session.email);

  const monthAgg = await cryptoPrisma.affiliatePlanPaymentMonthAgg.findFirst({
    where: { id: monthAggId },
    select: {
      idAfiliado: true,
      monthStart: true,
      invoice: {
        select: {
          pdfBytes: true,
          fileName: true,
          contentType: true,
        },
      },
    },
  });

  if (!monthAgg?.invoice) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!isAdmin && monthAgg.idAfiliado !== idAfiliadoPublic) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const raw = monthAgg.invoice.pdfBytes;
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const fallbackName = `nf-${monthAgg.monthStart.toISOString().slice(0, 7)}.pdf`;
  const ct = monthAgg.invoice.contentType || "application/pdf";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Disposition": contentDispositionAttachment(monthAgg.invoice.fileName, fallbackName),
      "Cache-Control": "private, no-store",
    },
  });
}
