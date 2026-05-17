/** Último `openTime` da vela em formação (linha 0) por par — atualizado pelo KlinesTable. */

const formingOpenTimeBySymbol: Record<string, string> = {};

export function setRobotLiveFormingOpenTime(symbol: string, openTime: string): void {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !openTime) return;
  formingOpenTimeBySymbol[sym] = openTime;
}

export function getRobotLiveFormingOpenTime(symbol: string): string | undefined {
  return formingOpenTimeBySymbol[symbol.trim().toUpperCase()];
}
