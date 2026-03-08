import { PrismaClient } from "./prisma-bio-client";

const globalForCrypto = globalThis as unknown as { cryptoPrisma: PrismaClient };
export const cryptoPrisma = globalForCrypto.cryptoPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForCrypto.cryptoPrisma = cryptoPrisma;
