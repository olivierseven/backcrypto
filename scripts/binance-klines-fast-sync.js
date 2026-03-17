/**
 * Dispara o sync de klines 1m + 1h (BinanceKlineFast e BinanceKline) chamando a API.
 * Única fonte da lógica: GET /api/cron (rota no app, mesmo do cron a cada minuto na Vercel).
 *
 * Uso: CRON_SECRET no .env. SYNC_URL opcional.
 * - Sem SYNC_URL: chama produção (https://backcrypto.vercel.app/crypto).
 * - Em dev: no .env.local defina SYNC_URL=http://localhost:3004/crypto e tenha o servidor rodando; o VBS atualiza o banco do .env (dev).
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const envLocal = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envLocal)) {
  require("dotenv").config({ path: envLocal, override: true });
}

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = (process.env.SYNC_URL || "https://backcrypto.vercel.app/crypto").replace(/\/$/, "");
const URL = `${BASE_URL}/api/cron`;

async function main() {
  if (!CRON_SECRET) {
    console.error("[binance-klines-fast-sync] CRON_SECRET não definido. Use .env ou variável de ambiente.");
    process.exit(1);
  }
  console.log("[binance-klines-fast-sync] Chamando", URL);
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
    console.error("[binance-klines-fast-sync] Erro", res.status, data?.error || text);
    process.exit(1);
  }
  console.log("[binance-klines-fast-sync] ok:", data?.ok);
  if (data?.result?.length) {
    data.result.forEach((r) =>
      console.log(
        `  ${r.symbol}: 1m inserted=${r.inserted} purged=${r.purged} | 1h inserted=${r.inserted1h} purged=${r.purged1h}`
      )
    );
  }
  console.log("[binance-klines-fast-sync] Done.");
}

main().catch((e) => {
  console.error("[binance-klines-fast-sync]", e);
  process.exit(1);
});
