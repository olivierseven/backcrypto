import { PrismaClient } from "./prisma-bio-client";

const globalForBio = globalThis as unknown as { bioPrisma: PrismaClient };
export const bioPrisma = globalForBio.bioPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForBio.bioPrisma = bioPrisma;
