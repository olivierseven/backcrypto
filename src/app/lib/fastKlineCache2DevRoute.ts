import { NextRequest, NextResponse } from "next/server";
import { isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";
import { getCryptoPrismaDev } from "@/lib/crypto-db";
import {
  fastKlineCache2GetJson,
  fastKlineCache2PostJson,
} from "@/app/lib/fastKlineCache2FromFast";
import type { FastChartKind } from "@/app/lib/fastKlineCache2FromFast";

/** Rotas dev dedicadas por tipo (chartKind implícito na URL). */
export function createFastKlineCache2Handlers(chartKind: FastChartKind) {
  return {
    async GET() {
      if (!isCryptoDevRoutesEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(
        fastKlineCache2GetJson(chartKind, { implicitChartKind: true })
      );
    },
    async POST(request: NextRequest) {
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
        body as Record<string, unknown>,
        chartKind
      );
      if ("error" in result) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    },
  };
}
