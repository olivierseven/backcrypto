import { decryptSensitiveString } from "@/lib/crypto";
import { cryptoPrisma } from "@/lib/crypto-db";

export async function getUserBinanceCredentials(userId: string): Promise<{ apiKey: string; apiSecret: string } | null> {
  const row = await cryptoPrisma.userBinanceConnection.findUnique({
    where: { userId },
    select: { payloadEnc: true, payloadIv: true, payloadTag: true },
  });
  if (!row) return null;
  try {
    const raw = decryptSensitiveString(row.payloadEnc, row.payloadIv, row.payloadTag);
    const o = JSON.parse(raw) as { apiKey?: string; apiSecret?: string };
    if (typeof o.apiKey === "string" && typeof o.apiSecret === "string") {
      return { apiKey: o.apiKey, apiSecret: o.apiSecret };
    }
  } catch {
    /* ignore */
  }
  return null;
}
