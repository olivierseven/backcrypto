/**
 * Roda a sincronização de klines (fast) a cada 1 minuto (para deixar em segundo plano).
 * Uso: node scripts/binance-klines-fast-sync-loop.js
 * Ou: npm run binance-klines-fast-sync:loop
 *
 * Na primeira vez executa logo; depois a cada 1 min. Alternativa: usar Agendador de Tarefas para rodar binance-klines-fast-sync.js a cada 1 min.
 */

const path = require("path");
const { spawn } = require("child_process");

const INTERVAL_MS = 1 * 60 * 1000; // 1 minuto
const scriptPath = path.resolve(__dirname, "binance-klines-fast-sync.js");

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
      shell: true,
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("exit " + code))));
    child.on("error", reject);
  });
}

async function main() {
  console.log("[binance-klines-fast-sync-loop] Sincronização a cada 5 minutos. Ctrl+C para parar.\n");
  for (;;) {
    const start = Date.now();
    try {
      await runSync();
    } catch (e) {
      console.error("[binance-klines-fast-sync-loop] Erro nesta execução:", e.message);
    }
    const elapsed = Date.now() - start;
    const wait = Math.max(0, INTERVAL_MS - elapsed);
    console.log("[binance-klines-fast-sync-loop] Próxima execução em " + Math.round(wait / 1000) + " s.\n");
    await new Promise((r) => setTimeout(r, wait));
  }
}

main();
