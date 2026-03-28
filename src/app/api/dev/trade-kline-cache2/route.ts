import { NextRequest, NextResponse } from "next/server";
import { isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";
import { getCryptoPrismaDev } from "@/lib/crypto-db";
import {
  tradeKlineCache2GetJson,
  tradeKlineCache2PostJson,
} from "@/app/lib/tradeKlineCache2FromFast";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isCryptoDevRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tradeKlineCache2GetJson({ implicitRoute: true }));
}

export async function POST(request: NextRequest) {
  if (!isCryptoDevRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const db = getCryptoPrismaDev();
  const result = await tradeKlineCache2PostJson(db, body as Record<string, unknown>);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
