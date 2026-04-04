import { NextRequest, NextResponse } from "next/server";
import { getSymbolSpotFilters } from "@/lib/binance-exchange-filters";

/** LOT_SIZE / PRICE_FILTER públicos (exchangeInfo), para UI alinhar quantidade/preço antes do POST de ordem. */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  if (symbol.length < 5 || symbol.length > 32) {
    return NextResponse.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const filters = await getSymbolSpotFilters(symbol);
  return NextResponse.json(filters);
}
