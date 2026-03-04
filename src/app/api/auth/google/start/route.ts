// GET /api/auth/google/start — inicia OAuth Google (Bio)
import { NextResponse } from "next/server";
import crypto from "crypto";
import { dbg, log as vLog } from "@/lib/logger";
import { getRedirectOrigin } from "@/lib/redirect-origin";

const BASE_PATH = "/backcrypto";
const CID = process.env.GOOGLE_CLIENT_ID;

function rand(n = 16): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString("base64url");
}

function signState(state: string): string {
  const secret = process.env.JWT_SECRET || "dev-secret";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(state);
  const signature = hmac.digest("base64url");
  return `${state}.${signature}`;
}

export async function GET(req: Request) {
  const start = Date.now();
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || `${BASE_PATH}/sistema`;
  const fromAppParam = url.searchParams.get("from_app") === "1";
  const ua = req.headers.get("user-agent") || "";
  const isMobile = /android|iphone|ipad|mobile/i.test(ua);
  const fromApp = fromAppParam || isMobile;

  if (!CID) {
    dbg("[bio/auth/google/start] GOOGLE_CLIENT_ID not configured");
    const origin = getRedirectOrigin(req);
    return NextResponse.redirect(`${origin}${BASE_PATH}/login?login=server`, { status: 303 });
  }

  const state = rand(24);
  const nonce = rand(24);

  vLog(`[bio/auth/google/start] next=${next} fromApp=${fromApp} isMobile=${isMobile} ua=${ua.slice(0, 50)}...`);
  dbg(`[bio/auth/google/start] state=${state.slice(0, 8)}...`);

  const origin = getRedirectOrigin(req);
  const redirectUri = `${origin}${BASE_PATH}/api/auth/google/callback`;

  const signedState = signState(state);
  const statePayload = `${signedState}~${next}${fromApp ? "~app" : ""}`;
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(CID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&prompt=select_account` +
    `&state=${encodeURIComponent(statePayload)}` +
    `&nonce=${encodeURIComponent(nonce)}`;

  const res = NextResponse.redirect(authUrl, { status: 303 });
  const isProd = process.env.NODE_ENV === "production";

  const opts = {
    httpOnly: true,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    secure: isProd,
    path: "/",
    maxAge: 10 * 60,
  };
  res.cookies.set("oauth_state", state, opts);
  res.cookies.set("oauth_nonce", nonce, opts);

  vLog(`[bio/auth/google/start] success next=${next} took=${Date.now() - start}ms`);
  return res;
}
