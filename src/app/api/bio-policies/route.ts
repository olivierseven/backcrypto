// GET …/api/bio-policies — políticas SevenCoins (terms, privacy, …) para o app Crypto
// Busca o HTML de sevencoins.com.br (terms, privacy, refund-policy, contato) no servidor.
// Envia cookie sevencoins-lang (mesmo nome do usePreferredLang no SevenCoins) para o servidor devolver no idioma escolhido.
import { NextResponse } from "next/server";

const SEVENCOINS_BASE = "https://sevencoins.com.br";

/** Mesmo nome usado no SevenCoins (usePreferredLang / LANG_COOKIE_NAME) para a API usar. */
const LANG_COOKIE_NAME = "sevencoins-lang";

function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/** Remove botões (não aparecem). Links viram <span> (texto visível, não clicável — ex.: "Back to home"). */
function stripButtonsAndLinks(html: string): string {
  let out = html;
  out = out.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "");
  out = out.replace(/<input\b[^>]*\btype=["'](?:submit|button)["'][^>]*\/?>/gi, "");
  out = out.replace(/<a\b[^>]*>/gi, "<span>");
  out = out.replace(/<\/a>/gi, "</span>");
  return out;
}

/** Extrai apenas o conteúdo principal da página (sem header, footer, nav). */
function extractMainContent(html: string): string {
  let out = html;
  // Remove header, footer, nav e aside
  out = out.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "");
  out = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "");
  out = out.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "");
  out = out.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, "");
  // Prioridade: extrair só o <main> ou <article>
  const mainMatch = out.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1].trim();
  const articleMatch = out.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1].trim();
  // Fallback: região com role="main"
  const roleMatch = out.match(/<div[^>]*\srole=["']main["'][^>]*>([\s\S]*?)<\/div>/i);
  if (roleMatch) return roleMatch[1].trim();
  // Último fallback: body já sem header/footer
  const bodyMatch = out.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const langParam = searchParams.get("lang");
  const lang = langParam === "en" ? "en" : "pt";

  const pathMap: Record<string, string> = {
    terms: "/terms",
    privacy: "/privacy",
    "refund-policy": "/refund-policy",
    contato: "/contato",
  };
  const path = pathMap[type ?? ""];
  if (!path) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  // Incluir lang na URL para o cache do Next.js ser por idioma (fetch usa só URL como chave, não Cookie)
  const url = `${SEVENCOINS_BASE}${path}?lang=${lang}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Backtest Crypto/1.0 (SevenCoins)",
        Cookie: `${LANG_COOKIE_NAME}=${lang}`,
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream_error", status: res.status },
        { status: 502 }
      );
    }
    let html = await res.text();
    html = stripScripts(html);
    html = extractMainContent(html);
    html = stripButtonsAndLinks(html);
    // Links e recursos com path absoluto (/) passam a apontar para SevenCoins (para imagens etc.)
    html = html.replace(/\s(href|src)=["']\/(?!\/)/g, ` $1="${SEVENCOINS_BASE}/`);
    return NextResponse.json({ html });
  } catch (e) {
    return NextResponse.json(
      { error: "fetch_failed", message: e instanceof Error ? e.message : "Unknown error" },
      { status: 502 }
    );
  }
}
