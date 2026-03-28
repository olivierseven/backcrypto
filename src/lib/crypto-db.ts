import { PrismaClient } from "./prisma-bio-client";

const globalForCrypto = globalThis as unknown as {
  cryptoPrisma: PrismaClient;
  cryptoPrismaProd?: PrismaClient;
  cryptoPrismaDev?: PrismaClient;
};
export const cryptoPrisma = globalForCrypto.cryptoPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrisma = cryptoPrisma;

/** Client para o banco de desenvolvimento (URL_DEV). No debug Hist (dev) usa este. Se URL_DEV não estiver definido, usa cryptoPrisma (DATABASE_URL). */
export function getCryptoPrismaDev(): PrismaClient {
  const url = process.env.URL_DEV?.trim();
  if (!url) return cryptoPrisma;
  if (globalForCrypto.cryptoPrismaDev) return globalForCrypto.cryptoPrismaDev;
  const client = new PrismaClient({ datasources: { db: { url } } });
  if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrismaDev = client;
  return client;
}

/** Client para o banco de produção (URL_PROD). No debug Hist (prod) usa este. */
export function getCryptoPrismaProd(): PrismaClient {
  if (globalForCrypto.cryptoPrismaProd) return globalForCrypto.cryptoPrismaProd;
  const url = process.env.URL_PROD?.trim();
  if (!url) throw new Error("URL_PROD not set in .env (connection string do banco de produção)");
  const client = new PrismaClient({ datasources: { db: { url } } });
  if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrismaProd = client;
  return client;
}

/**
 * Leituras de cache atemporal (`BinanceKlineCache2`) em **desenvolvimento local**: se `URL_PROD` estiver no `.env`,
 * usa o mesmo Postgres que produção para o gráfico /sistema bater com dados reais. Em `NODE_ENV=production` (build)
 * usa sempre `cryptoPrisma` (DATABASE_URL do deploy). Sessão/fuso do utilizador continuam no `cryptoPrisma` local.
 */
export function prismaForAtemporalCacheRead(): PrismaClient {
  if (process.env.NODE_ENV === "production") return cryptoPrisma;
  const url = process.env.URL_PROD?.trim();
  if (!url) return cryptoPrisma;
  try {
    return getCryptoPrismaProd();
  } catch {
    return cryptoPrisma;
  }
}
