import "dotenv/config";
import http from "node:http";
import { createPrisma } from "./prismaClient.js";
import { runCacheRefresh } from "./runCacheRefresh.js";
import { startVpsStallWatchdog } from "./vpsStallWatchdog.js";

const runOnce = process.argv.includes("--once");

const HTTP_PORT = Number(process.env.TEMPORAL_CACHE_HTTP_PORT ?? "3047");
const DB_RETRY_BASE_MS = Number(process.env.VPS_DB_RETRY_BASE_MS ?? "2000");
const DB_RETRY_MAX_MS = Number(process.env.VPS_DB_RETRY_MAX_MS ?? "30000");
const CYCLE_MAX_MS = Math.max(
  60_000,
  Number(process.env.TEMPORAL_CACHE_CYCLE_MAX_MS ?? String(45 * 60 * 1000))
);
const BUSY_STUCK_MS = Math.max(
  CYCLE_MAX_MS,
  Number(process.env.TEMPORAL_CACHE_BUSY_STUCK_MS ?? String(50 * 60 * 1000))
);
const SKIP_LOG_THROTTLE_MS = 60_000;

/** Ms até à próxima meia-noite no fuso horário local do servidor (TZ do processo Node). */
function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function formatLocalMidnightLabel(): string {
  const next = new Date(Date.now() + msUntilNextLocalMidnight());
  return next.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function isPrismaDbUnreachableError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) {
    return /can't reach database server/i.test(String(e ?? ""));
  }
  const code = (e as { code?: string }).code;
  if (code === "P1001" || code === "P1017") return true;
  const name = String((e as { name?: string }).name ?? "");
  const msg = String((e as { message?: string }).message ?? "");
  return /PrismaClientInitializationError/i.test(name) || /can't reach database server/i.test(msg);
}

function clampRetryMs(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const RETRY_BASE_MS = clampRetryMs(DB_RETRY_BASE_MS, 2000);
const RETRY_MAX_MS = Math.max(clampRetryMs(DB_RETRY_MAX_MS, 30000), RETRY_BASE_MS);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDbReconnectRetry<T>(label: string, task: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (e) {
      if (!isPrismaDbUnreachableError(e)) throw e;
      const code = (e as { code?: string }).code ?? "?";
      const waitMs = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.max(1, 2 ** attempt));
      console.warn(
        `[sync-temporal-cache] ${label}: DB indisponível (${code}). Nova tentativa em ${waitMs}ms (tentativa ${attempt + 1})`
      );
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

function startHealthServer(): http.Server | null {
  if (!Number.isFinite(HTTP_PORT) || HTTP_PORT <= 0) return null;
  const server = http.createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    if (path === "/" || path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(HTTP_PORT, "0.0.0.0", () => {
    console.log(`[sync-temporal-cache] health http://0.0.0.0:${HTTP_PORT}/health`);
  });
  return server;
}

let busy = false;
let busySinceMs = 0;
let lastSkipLogAt = 0;
const db = createPrisma();
const stallWatchdog = startVpsStallWatchdog("sync-temporal-cache");

async function runRefreshCycle(): Promise<void> {
  const refreshTask = runCacheRefresh(db, {
    onSymbolDone: (symbol) => {
      stallWatchdog.touch();
      console.log(`[sync-temporal-cache] progresso símbolo ${symbol}`);
    },
  });
  const timeoutTask = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`ciclo excedeu ${CYCLE_MAX_MS}ms — exit 1 para PM2 reiniciar`)),
      CYCLE_MAX_MS
    );
  });
  const data = await Promise.race([refreshTask, timeoutTask]);
  console.log(
    `[sync-temporal-cache] ok ${new Date().toISOString()} totalRows=${data.totalRows} purged: 1m=${data.purgedFast} 5m=${data.purged5m} 1h=${data.purged1h}`
  );
}

async function tick(): Promise<void> {
  if (busy) {
    const stuckMs = Date.now() - busySinceMs;
    if (busySinceMs > 0 && stuckMs >= BUSY_STUCK_MS) {
      console.error(
        `[sync-temporal-cache] ciclo preso há ${Math.round(stuckMs / 1000)}s — exit 1 para PM2 reiniciar`
      );
      process.exit(1);
    }
    const now = Date.now();
    if (now - lastSkipLogAt >= SKIP_LOG_THROTTLE_MS) {
      lastSkipLogAt = now;
      console.warn(`[sync-temporal-cache] ciclo anterior ainda a correr — skip (${Math.round(stuckMs / 1000)}s)`);
    }
    return;
  }
  busy = true;
  busySinceMs = Date.now();
  stallWatchdog.touch();
  try {
    await withDbReconnectRetry("refresh", runRefreshCycle);
    stallWatchdog.touch();
  } catch (e) {
    console.error("[sync-temporal-cache]", e);
    if (e instanceof Error && e.message.includes("exit 1 para PM2")) {
      process.exit(1);
    }
  } finally {
    busy = false;
    busySinceMs = 0;
  }
}

let midnightTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextMidnightRun(): void {
  const waitMs = msUntilNextLocalMidnight();
  console.log(
    `[sync-temporal-cache] próxima corrida à meia-noite local (${formatLocalMidnightLabel()}) — em ${Math.round(waitMs / 1000)}s`
  );
  midnightTimer = setTimeout(() => {
    void tick().finally(() => scheduleNextMidnightRun());
  }, waitMs);
}

async function main(): Promise<void> {
  console.log(
    `[sync-temporal-cache] arranque modo=${runOnce ? "once" : "diário meia-noite local"} (Debug Refresh cache prod)`
  );

  if (runOnce) {
    await tick();
    stallWatchdog.stop();
    await db.$disconnect();
    process.exit(0);
    return;
  }

  const healthServer = startHealthServer();
  console.log("[sync-temporal-cache] corrida no arranque (restart PM2)");
  void tick();
  scheduleNextMidnightRun();

  const shutdown = async () => {
    stallWatchdog.stop();
    if (midnightTimer) clearTimeout(midnightTimer);
    if (healthServer) {
      await new Promise<void>((resolve) => healthServer.close(() => resolve()));
    }
    await db.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
