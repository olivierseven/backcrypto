// GET /api/auth/google/callback — callback OAuth Google (Crypto)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cryptoPrisma } from "@/lib/crypto-db";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { encryptEmail, emailSearchHash, normalizeEmail, decryptEmail } from "@/lib/crypto";
import { log as vLog, dbg, warn, error } from "@/lib/logger";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getRedirectOrigin } from "@/lib/redirect-origin";
import { createCompleteToken } from "@/lib/oauth-complete-token";
import { androidGoogleOAuthDeepLink, androidGoogleOAuthIntentUrl } from "@/app/lib/cryptoNativeApp";
import { safeCryptoNext, CRYPTO_LOGIN_PAGE } from "@/lib/crypto-auth-next";

const BASE_PATH = "/crypto";
const LOGIN_PAGE = CRYPTO_LOGIN_PAGE;

const CID = process.env.GOOGLE_CLIENT_ID;
const CSECRET = process.env.GOOGLE_CLIENT_SECRET;
const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const COOKIE_LAST = `${COOKIE}_last`;
const COOKIE_IAT = `${COOKIE}_iat`;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function verifySignedState(signedState: string): string | null {
  const secret = process.env.JWT_SECRET || "dev-secret";
  const parts = signedState.split(".");
  if (parts.length !== 2) return null;

  const [state, signature] = parts;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(state);
  const expectedSignature = hmac.digest("base64url");

  if (signature.length !== expectedSignature.length) return null;
  let matches = true;
  for (let i = 0; i < signature.length; i++) {
    matches = matches && signature[i] === expectedSignature[i];
  }
  return matches ? state : null;
}

export async function GET(req: Request) {
  const start = Date.now();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";

  const origin = getRedirectOrigin(req);

  function redirectTo(path: string, status = 303) {
    const target = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    return NextResponse.redirect(target, { status });
  }

  dbg(`[crypto/auth/google/callback] code=${code ? "present" : "missing"} state=${stateRaw.slice(0, 8)}...`);

  const cookieStore = await cookies();
  const cookieState = cookieStore.get("oauth_state")?.value;
  const cookieNonce = cookieStore.get("oauth_nonce")?.value;

  const parts = stateRaw.split("~");
  const [signedState, nextRaw, fromAppFlag] = parts;
  const next = safeCryptoNext(nextRaw);
  const fromApp = fromAppFlag === "app";

  const redirectUri = `${origin}${BASE_PATH}/api/auth/google/callback`;

  let validatedState: string | null = verifySignedState(signedState);
  if (!validatedState && cookieState && signedState === cookieState) {
    validatedState = cookieState;
  }

  if (!code || !signedState || !validatedState) {
    warn(`[crypto/auth/google/callback] invalid state or missing code`);
    return redirectTo(`${LOGIN_PAGE}?login=server`);
  }

  if (!CID || !CSECRET) {
    error("[crypto/auth/google/callback] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
    return redirectTo(`${LOGIN_PAGE}?login=server`);
  }

  try {
    const tokenParams: Record<string, string> = {
      client_id: CID,
      client_secret: CSECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams),
    });
    const tok = await tokenResp.json();
    if (!tokenResp.ok) {
      error(`[crypto/auth/google/callback] token exchange failed status=${tokenResp.status}`);
      return redirectTo(`${LOGIN_PAGE}?login=server`);
    }

    const idToken = tok.id_token as string;
    if (!idToken) {
      warn("[crypto/auth/google/callback] no id_token in response");
      return redirectTo(`${LOGIN_PAGE}?login=server`);
    }

    let payload: { email?: string; name?: string; nonce?: string };
    try {
      const result = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: CID,
      });
      payload = result.payload as { email?: string; name?: string; nonce?: string };
    } catch (verifyError) {
      error(`[crypto/auth/google/callback] id_token verification failed`);
      return redirectTo(`${LOGIN_PAGE}?login=server`);
    }

    if (payload.nonce && cookieNonce && payload.nonce !== cookieNonce) {
      warn("[crypto/auth/google/callback] nonce mismatch");
      return redirectTo(`${LOGIN_PAGE}?login=server`);
    }

    const emailClaim = String(payload.email || "");
    const emailNorm = normalizeEmail(emailClaim);
    if (!emailNorm) {
      warn("[crypto/auth/google/callback] invalid email claim");
      return redirectTo(`${LOGIN_PAGE}?login=server`);
    }

    const searchHash = emailSearchHash(emailNorm);
    let user = await cryptoPrisma.user.findUnique({
      where: { emailSearchHash: searchHash },
      select: {
        id: true,
        emailEnc: true,
        emailIv: true,
        emailTag: true,
        emailVerifiedAt: true,
        name: true,
        isDeleted: true,
        dataExpiracao: true,
        role: true,
      },
    });

    if (user?.isDeleted) {
      if (user.dataExpiracao && new Date(user.dataExpiracao) < new Date()) {
        warn("[crypto/auth/google/callback] account expired");
        return redirectTo(`${LOGIN_PAGE}?login=expired`);
      }
      warn("[crypto/auth/google/callback] account deactivated");
      return redirectTo(`${LOGIN_PAGE}?login=expired`);
    }

    if (!user) {
      const name = String(payload.name || "").slice(0, 80) || "Usuário Google";
      const { enc, iv, tag } = encryptEmail(emailNorm);
      const oauthPasswordHash = await bcrypt.hash(`oauth_${emailNorm}_${Date.now()}`, 10);
      const nickname = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      dbg(`[crypto/auth/google/callback] creating new user email=${emailNorm.slice(0, 3)}...`);
      user = await cryptoPrisma.user.create({
        data: {
          name,
          nickname,
          emailEnc: enc,
          emailIv: iv,
          emailTag: tag,
          emailSearchHash: searchHash,
          emailVerifiedAt: new Date(),
          passwordHash: oauthPasswordHash,
        },
        select: {
          id: true,
          emailEnc: true,
          emailIv: true,
          emailTag: true,
          emailVerifiedAt: true,
          name: true,
          isDeleted: true,
          dataExpiracao: true,
          role: true,
        },
      });
    } else if (!user.emailVerifiedAt) {
      await cryptoPrisma.user.update({
        where: { emailSearchHash: searchHash },
        data: { emailVerifiedAt: new Date() },
      });
    }

    const emailPlain = decryptEmail(user.emailEnc, user.emailIv, user.emailTag);
    const role = user.role || "user";

    const jwt = await new SignJWT({
      sub: user.id,
      email: emailPlain,
      role,
      isDeleted: false,
      dataExpiracao: null,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    if (fromApp) {
      const completeToken = createCompleteToken(jwt);
      const completeUrl = `${origin}${BASE_PATH}/api/auth/google/complete?token=${encodeURIComponent(completeToken)}&next=${encodeURIComponent(next)}`;
      const ua = req.headers.get("user-agent") || "";
      const isAndroid = /android/i.test(ua);
      // HTML com meta refresh para intent:// — Chrome segue 303 mas App Links não intercepta; intent abre o app
      const intentUrl = isAndroid
        ? androidGoogleOAuthIntentUrl(completeUrl)
        : androidGoogleOAuthDeepLink(completeUrl, next);
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${esc(intentUrl)}"></head><body><p>Redirecionando…</p></body></html>`;
      vLog(`[crypto/auth/google/callback] from_app=1 HTML intent (android=${isAndroid}) userId=${user.id.slice(0, 8)}... took=${Date.now() - start}ms`);
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const r = redirectTo(next);
    const baseCookie = {
      httpOnly: true as const,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    r.cookies.set(COOKIE, jwt, { ...baseCookie, maxAge: 24 * 60 * 60 });
    const now = Date.now().toString();
    r.cookies.set(COOKIE_IAT, now, baseCookie);
    r.cookies.set(COOKIE_LAST, now, baseCookie);
    r.cookies.set("oauth_state", "", { ...baseCookie, maxAge: 0 });
    r.cookies.set("oauth_nonce", "", { ...baseCookie, maxAge: 0 });

    vLog(`[crypto/auth/google/callback] success userId=${user.id.slice(0, 8)}... next=${next} took=${Date.now() - start}ms`);
    return r;
  } catch (e) {
    error(`[crypto/auth/google/callback] internal error: ${e instanceof Error ? e.message : e}`);
    return redirectTo(`${LOGIN_PAGE}?login=server`);
  }
}
