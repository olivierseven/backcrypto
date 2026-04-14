/**
 * Lista de símbolos (KlineSymbol, ativo = true) para dropdown do gráfico.
 * GET /api/klines/symbols — fallback BTCUSDT, ETHUSDT se vazia.
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

const FALLBACK = ["BTCUSDT", "ETHUSDT"];

export async function GET() {
  try {
    const symbols = await getKlineSymbolsFromDb(cryptoPrisma);
    return NextResponse.json({
      symbols: symbols.length > 0 ? symbols : FALLBACK,
    });
  } catch (e) {
    console.error("[api/klines/symbols]", e);
    return NextResponse.json({ symbols: FALLBACK });
  }
}
