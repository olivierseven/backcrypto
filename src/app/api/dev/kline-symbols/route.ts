/**
 * Lista KlineSymbol (ativo) do mesmo DB que `getCryptoPrismaDev()` — para dev/ticks alinhar ao VPS/sistema.
 * GET — sem cookie; rota só existe com rotas dev ativas.
 */
import { NextResponse } from "next/server";
import { isCryptoDevRoutesEnabled } from "@/lib/crypto-dev-routes";
import { getCryptoPrismaDev } from "@/lib/crypto-db";
import { DEFAULT_SYMBOLS_LIST, getKlineSymbolsFromDb } from "@/app/lib/kline-symbols";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isCryptoDevRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const db = getCryptoPrismaDev();
    const symbols = await getKlineSymbolsFromDb(db);
    const list = symbols.length > 0 ? symbols : [...DEFAULT_SYMBOLS_LIST];
    return NextResponse.json({ symbols: list });
  } catch (e) {
    console.error("[api/dev/kline-symbols]", e);
    return NextResponse.json({ symbols: [...DEFAULT_SYMBOLS_LIST] });
  }
}
