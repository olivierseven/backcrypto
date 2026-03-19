// GET /api/session/claim — reivindica a sessão ativa para esta aba (header X-Tab-Id).
// Retorna 200 se esta aba for a ativa; 409 se outra aba já estiver ativa (evita múltiplas abas).
// No primeiro acesso (sem nenhum crédito), cria o trial lite (1 coin / 1 dia) para o usuário virar lite.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { claimOrRejectSession, getTabIdFromRequest, getForceClaimFromRequest } from "@/lib/session-tab-claim";
import { isFirstLoginCryptoLiteTrial, createCryptoLiteTrialPackage } from "@/lib/crypto-bonus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET(request: Request) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    userId = typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Primeiro acesso: trial lite (1 coin / 1 dia) — session/claim é chamado ao carregar /sistema.
  if (await isFirstLoginCryptoLiteTrial(userId)) {
    await createCryptoLiteTrialPackage(userId);
  }

  const tabId = getTabIdFromRequest(request);
  if (!tabId || !tabId.trim()) {
    return NextResponse.json({ error: "tab id required", code: "TAB_ID_REQUIRED" }, { status: 400 });
  }
  const forceTakeOver = getForceClaimFromRequest(request);
  const reject = await claimOrRejectSession(request, userId, tabId.trim(), forceTakeOver);
  if (reject) return reject;

  return NextResponse.json({ ok: true });
}
