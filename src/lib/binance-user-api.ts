import crypto from "crypto";

const BINANCE_BASE = (process.env.BINANCE_API_BASE_URL ?? "https://api.binance.com").replace(/\/$/, "");

export type BinanceAccountBalance = {
  asset: string;
  free: string;
  locked: string;
};

type BinanceAccountResponse = {
  balances?: BinanceAccountBalance[];
};

function useBinanceProxy(): boolean {
  return Boolean(process.env.BINANCE_PROXY_URL?.trim() && process.env.BINANCE_PROXY_SECRET?.trim());
}

function binanceProxyBaseUrl(): string {
  return process.env.BINANCE_PROXY_URL!.replace(/\/$/, "");
}

type RelayPayload =
  | { kind: "get"; url: string; headers: { "X-MBX-APIKEY": string } }
  | { kind: "delete"; url: string; headers: { "X-MBX-APIKEY": string } }
  | {
      kind: "post";
      url: string;
      headers: { "X-MBX-APIKEY": string; "Content-Type": "application/x-www-form-urlencoded" };
      body: string;
    };

async function relaySignedRequestToVps(payload: RelayPayload): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${binanceProxyBaseUrl()}/v1/relay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BINANCE_PROXY_SECRET}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/** GET público relayado na VPS (mesmo IP que ordens assinadas), só `exchangeInfo?symbol=`. */
async function relayPublicExchangeInfoToVps(fullUrl: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${binanceProxyBaseUrl()}/v1/relay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BINANCE_PROXY_SECRET}`,
    },
    body: JSON.stringify({ kind: "public_get", url: fullUrl }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

const EXCHANGE_INFO_FETCH_MS = 22_000;

/**
 * `GET /api/v3/exchangeInfo?symbol=` — sem assinatura. Com `BINANCE_PROXY_*`, o pedido sai pela VPS (rota fixa / região do servidor).
 */
export async function fetchBinanceExchangeInfo(symbol: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const sym = symbol.trim().toUpperCase();
  const url = `${BINANCE_BASE}/api/v3/exchangeInfo?symbol=${encodeURIComponent(sym)}`;
  if (useBinanceProxy()) {
    return relayPublicExchangeInfoToVps(url);
  }
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(EXCHANGE_INFO_FETCH_MS),
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function buildSignedQuery(secret: string, extraParams: Record<string, string> = {}): { queryString: string; signature: string } {
  const timestamp = Date.now().toString();
  const params = new URLSearchParams({ timestamp, ...extraParams });
  const keys = [...params.keys()].sort();
  const ordered = new URLSearchParams();
  for (const k of keys) {
    const v = params.get(k);
    if (v !== null) ordered.set(k, v);
  }
  const queryString = ordered.toString();
  const signature = crypto.createHmac("sha256", secret).update(queryString).digest("hex");
  return { queryString, signature };
}

/**
 * GET assinado (Spot). Usado para validar chaves e ler conta.
 */
export async function binanceSignedGet(
  path: string,
  apiKey: string,
  apiSecret: string,
  extraParams: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const { queryString, signature } = buildSignedQuery(apiSecret, extraParams);
  const url = `${BINANCE_BASE}${path}?${queryString}&signature=${signature}`;
  if (useBinanceProxy()) {
    return relaySignedRequestToVps({
      kind: "get",
      url,
      headers: { "X-MBX-APIKEY": apiKey },
    });
  }
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * DELETE assinado (query string, como GET). Spot: cancelar `/api/v3/order`, etc.
 */
export async function binanceSignedDelete(
  path: string,
  apiKey: string,
  apiSecret: string,
  extraParams: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const { queryString, signature } = buildSignedQuery(apiSecret, extraParams);
  const url = `${BINANCE_BASE}${path}?${queryString}&signature=${signature}`;
  if (useBinanceProxy()) {
    return relaySignedRequestToVps({
      kind: "delete",
      url,
      headers: { "X-MBX-APIKEY": apiKey },
    });
  }
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * POST assinado (form urlencoded). Spot: `/api/v3/order`, etc.
 */
export async function binanceSignedPost(
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const timestamp = Date.now().toString();
  const all: Record<string, string> = { ...params, timestamp };
  const keys = Object.keys(all).sort();
  const qs = new URLSearchParams();
  for (const k of keys) {
    qs.set(k, all[k]!);
  }
  const queryString = qs.toString();
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
  const body = `${queryString}&signature=${signature}`;
  const postUrl = `${BINANCE_BASE}${path}`;
  if (useBinanceProxy()) {
    return relaySignedRequestToVps({
      kind: "post",
      url: postUrl,
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }
  const res = await fetch(postUrl, {
    method: "POST",
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export async function fetchBinanceAccount(apiKey: string, apiSecret: string): Promise<{
  ok: true;
  balances: BinanceAccountBalance[];
} | { ok: false; status: number; code?: number; msg?: string }> {
  const { ok, status, json } = await binanceSignedGet("/api/v3/account", apiKey, apiSecret);
  if (!ok || typeof json !== "object" || json === null) {
    const j = json as { code?: number; msg?: string } | null;
    return { ok: false, status, code: j?.code, msg: j?.msg };
  }
  const data = json as BinanceAccountResponse;
  const balances = Array.isArray(data.balances) ? data.balances : [];
  return { ok: true, balances };
}
