import { NextRequest, NextResponse } from "next/server";
import {
  createBypassToken,
  getBypassCookieName,
  MAINTENANCE_BYPASS_COOKIE_OPTIONS,
} from "@/lib/maintenance-bypass";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.SITE_MAINTENANCE !== "1") {
    return NextResponse.json({ ok: true, message: "Site not in maintenance" });
  }

  const password = process.env.MAINTENANCE_BYPASS_PASSWORD?.trim();
  if (!password) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const submitted = String(body?.password ?? "").trim();
  if (submitted !== password) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const token = createBypassToken();
  if (!token) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getBypassCookieName(), token, MAINTENANCE_BYPASS_COOKIE_OPTIONS);
  return res;
}
