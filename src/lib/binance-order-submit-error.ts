/** Resposta JSON de erro do POST `/api/user/binance-connection/order`. */
export type BinanceOrderSubmitErrorJson = {
  error?: string;
  minNotional?: string;
  msg?: string;
  code?: number;
};

function formatMinNotionalForDisplay(s: string): string {
  const n = parseFloat(s.trim());
  if (!Number.isFinite(n) || n <= 0) return s.trim();
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
}

/**
 * Mensagem para o utilizador a partir do corpo de erro da API (incl. pré-validação `binance_min_notional`).
 */
export function formatBinanceOrderSubmitUserMessage(
  data: BinanceOrderSubmitErrorJson,
  t: { tradingBinanceMinNotional: string; tradingBinanceNotionalGeneric: string },
): string {
  if (
    data.error === "binance_min_notional" &&
    typeof data.minNotional === "string" &&
    data.minNotional.trim() !== ""
  ) {
    return t.tradingBinanceMinNotional.replace("{min}", formatMinNotionalForDisplay(data.minNotional));
  }
  if (data.error === "binance_notional") {
    if (typeof data.minNotional === "string" && data.minNotional.trim() !== "") {
      return t.tradingBinanceMinNotional.replace("{min}", formatMinNotionalForDisplay(data.minNotional));
    }
    return t.tradingBinanceNotionalGeneric;
  }
  const raw = typeof data.msg === "string" ? data.msg : "";
  if (/notional/i.test(raw)) {
    return t.tradingBinanceNotionalGeneric;
  }
  if (raw.trim() !== "") return raw;
  if (typeof data.error === "string" && data.error.trim() !== "") return data.error;
  return "order_failed";
}
