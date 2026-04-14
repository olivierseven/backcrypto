// GET /api/auth/verify?token=... — verificação de e-mail (cadastro Bio)
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { consumeEmailVerificationToken } from "@/lib/token";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate";
import { log as vLog, dbg, warn, error } from "@/lib/logger";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { getRedirectOrigin } from "@/lib/redirect-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFY_PER_IP_LIMIT = 10;
const VERIFY_PER_IP_WINDOW = 60_000;
const VERIFY_PER_TOKEN_LIMIT = 3; // permite retries (duplo clique, prefetch do navegador)
const VERIFY_PER_TOKEN_WINDOW = 60_000;

function getBaseUrl(req: Request): string {
  return getRedirectOrigin(req) + APP_CRYPTO_ROUTE_PREFIX;
}

function loginUrl(req: Request, query = "") {
  return getBaseUrl(req) + "/login" + (query ? `?${query}` : "");
}

export async function GET(req: Request) {
  const start = Date.now();

  const { ok: ipOk, retryAfter: ipRetry } = rateLimit(
    clientKeyFromRequest(req, "verify"),
    VERIFY_PER_IP_LIMIT,
    VERIFY_PER_IP_WINDOW
  );
  if (!ipOk) {
    warn(`[auth/verify] ip rate limited retry=${Math.ceil(ipRetry / 1000)}s`);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(ipRetry / 1000)) },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    if (!token) {
      warn("[auth/verify] missing token");
      return NextResponse.redirect(loginUrl(req, "verified=invalid"), { status: 303 });
    }

    dbg(`[auth/verify] processing token=${token.slice(0, 8)}...`);

    const { ok: tokOk, retryAfter: tokRetry } = rateLimit(
      `verify:tok:${token.slice(0, 16)}`,
      VERIFY_PER_TOKEN_LIMIT,
      VERIFY_PER_TOKEN_WINDOW
    );
    if (!tokOk) {
      warn(`[auth/verify] token rate limited retry=${Math.ceil(tokRetry / 1000)}s`);
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(tokRetry / 1000)) },
      });
    }

    const result = await consumeEmailVerificationToken(token);
    if (!result.ok) {
      warn(`[auth/verify] token invalid token=${token.slice(0, 8)}...`);
      return NextResponse.redirect(loginUrl(req, "verified=invalid"), { status: 303 });
    }

    await cryptoPrisma.user.update({
      where: { id: result.userId },
      data: { emailVerifiedAt: new Date() },
    });

    vLog(`[auth/verify] success userId=${result.userId.slice(0, 8)}... took=${Date.now() - start}ms`);
    return NextResponse.redirect(loginUrl(req, "verified=ok"), { status: 303 });
  } catch (e) {
    error(`[auth/verify] internal error msg=${e instanceof Error ? e.message : e}`);
    return NextResponse.redirect(loginUrl(req, "verified=invalid"), { status: 303 });
  }
}
