import { PrismaClient } from "@prisma/client";

export function createPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Defina DATABASE_URL no .env (Neon prod)");
  }
  return new PrismaClient();
}
