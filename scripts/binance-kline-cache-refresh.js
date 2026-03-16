/**
 * Dispara o refresh do BinanceKlineCache chamando a API (mesma lógica do cron diário).
 * Única fonte da lógica: GET /api/cron/cache-refresh (rota no app).
 *
 * Uso: CRON_SECRET=xxx node scripts/binance-kline-cache-refresh.js
 *      CACHE_REFRESH_URL=https://backcrypto.vercel.app/crypto node scripts/binance-kline-cache-refresh.js
 * Requer: CRON_SECRET no .env ou em variável de ambiente.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = (process.env.CACHE_REFRESH_URL || "https://backcrypto.vercel.app/crypto").replace(/\/$/, "");
const URL = `${BASE_URL}/api/cron/cache-refresh`;

async function main() {
  if (!CRON_SECRET) {
    console.error("[binance-kline-cache-refresh] CRON_SECRET não definido. Use .env ou variável de ambiente.");
    process.exit(1);
  }
  console.log("[binance-kline-cache-refresh] Chamando", URL);
  const res = await fetch(URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!res.ok) {
    console.error("[binance-kline-cache-refresh] Erro", res.status, data?.error || text);
    process.exit(1);
  }
  console.log("[binance-kline-cache-refresh] ok:", data?.ok, "totalRows:", data?.totalRows);
  if (data?.details?.length) {
    data.details.forEach((d) => console.log(`  ${d.symbol} ${d.interval}: ${d.rows} rows`));
  }
  console.log("[binance-kline-cache-refresh] Done.");
}

main().catch((e) => {
  console.error("[binance-kline-cache-refresh]", e);
  process.exit(1);
});
