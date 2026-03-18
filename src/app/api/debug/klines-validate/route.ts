/**
 * Validação de klines: verifica ausência de intervalos pulados.
 * - 1m: BinanceKlineFast
 * - 5m: BinanceKlineMonth
 * - 1h: BinanceKline
 * Apenas admin. Só em dev. GET /api/debug/klines-validate?symbol=BTCUSDT&target=dev|prod
 * Opcional: interval=1m | 5m | 1h — se omitido, valida as três tabelas. target=prod usa URL_PROD.
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@/lib/prisma-bio-client";
import { cryptoPrisma, getCryptoPrismaDev, getCryptoPrismaProd } from "@/lib/crypto-db";
import {
  DEFAULT_REQUIRED_DAYS_1H,
  DEFAULT_REQUIRED_DAYS_1M,
  DEFAULT_REQUIRED_DAYS_5M,
  getKlineSymbolsWithPeriods,
  resolveSymbol,
} from "@/app/lib/kline-symbols";
import { validate1m, validate5m, validate1h } from "@/app/lib/klines-validate";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Validação só disponível em desenvolvimento" }, { status: 404 });
    }

    const token = request.cookies.get(COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const target = request.nextUrl.searchParams.get("target") === "prod" ? "prod" : "dev";
    const db: PrismaClient = target === "prod" ? (() => {
      try {
        return getCryptoPrismaProd();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "URL_PROD not set");
      }
    })() : getCryptoPrismaDev();

    const symbolsWithPeriods = await getKlineSymbolsWithPeriods(db);
    const symbolList = symbolsWithPeriods.map((s) => s.symbol);
    const symbol = resolveSymbol(request.nextUrl.searchParams.get("symbol")?.trim(), symbolList);
    const periods = symbolsWithPeriods.find((s) => s.symbol === symbol) ?? {
      symbol,
      requiredDays1m: DEFAULT_REQUIRED_DAYS_1M,
      requiredDays5m: DEFAULT_REQUIRED_DAYS_5M,
      requiredDays1h: DEFAULT_REQUIRED_DAYS_1H,
    };
    const intervalParam = request.nextUrl.searchParams.get("interval")?.trim().toLowerCase();

    if (intervalParam === "1h") {
      const result = await validate1h(db, symbol, periods.requiredDays1h);
      return NextResponse.json(result);
    }
    if (intervalParam === "5m") {
      const result = await validate5m(db, symbol, periods.requiredDays5m);
      return NextResponse.json(result);
    }
    if (intervalParam === "1m") {
      const result = await validate1m(db, symbol, periods.requiredDays1m);
      return NextResponse.json(result);
    }
    const [result1m, result5m, result1h] = await Promise.all([
      validate1m(db, symbol, periods.requiredDays1m),
      validate5m(db, symbol, periods.requiredDays5m),
      validate1h(db, symbol, periods.requiredDays1h),
    ]);
    return NextResponse.json({ "1m": result1m, "5m": result5m, "1h": result1h });
  } catch (e) {
    console.error("[api/debug/klines-validate]", e);
    return NextResponse.json(
      { error: "Erro ao validar klines" },
      { status: 500 }
    );
  }
}
