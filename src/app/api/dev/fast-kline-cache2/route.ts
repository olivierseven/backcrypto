import { NextRequest, NextResponse } from "next/server";
import { isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";
import { getCryptoPrismaDev } from "@/lib/crypto-db";
import {
  fastKlineCache2GetAllKindsJson,
  fastKlineCache2GetJson,
  fastKlineCache2PostJson,
  isFastChartKind,
} from "@/app/lib/fastKlineCache2FromFast";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isCryptoDevRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const q = request.nextUrl.searchParams.get("chartKind")?.trim();
  if (!q) {
    return NextResponse.json(fastKlineCache2GetAllKindsJson());
  }
  if (!isFastChartKind(q)) {
    return NextResponse.json({ error: "chartKind inválido" }, { status: 400 });
  }
  return NextResponse.json(fastKlineCache2GetJson(q));
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
  const result = await fastKlineCache2PostJson(
    db,
    body as Record<string, unknown>
  );
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
