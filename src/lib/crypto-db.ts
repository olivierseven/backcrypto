import { PrismaClient } from "./prisma-bio-client";

const globalForCrypto = globalThis as unknown as { cryptoPrisma: PrismaClient; cryptoPrismaProd?: PrismaClient };
export const cryptoPrisma = globalForCrypto.cryptoPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrisma = cryptoPrisma;

/** Client para o banco de produção (URL_PROD). Usado no backfill quando Alvo = Prod. */
export function getCryptoPrismaProd(): PrismaClient {
  if (globalForCrypto.cryptoPrismaProd) return globalForCrypto.cryptoPrismaProd;
  const url = process.env.URL_PROD?.trim();
  if (!url) throw new Error("URL_PROD not set in .env (connection string do banco de produção)");
  const client = new PrismaClient({ datasources: { db: { url } } });
  if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrismaProd = client;
  return client;
}
