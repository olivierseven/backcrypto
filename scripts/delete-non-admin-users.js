/**
 * Remove todos os usuários que não são admin (mantém apenas role === 'admin').
 * As tabelas relacionadas são apagadas em cascata (onDelete: Cascade).
 *
 * Uso: node scripts/delete-non-admin-users.js
 * Requer: DATABASE_URL no .env (ou BG_DATABASE_URL; o script usa DATABASE_URL).
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// Prisma usa DATABASE_URL; se só tiver BG_DATABASE_URL, usa como fallback
if (!process.env.DATABASE_URL && process.env.BG_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.BG_DATABASE_URL;
}

const { PrismaClient } = require("../src/lib/prisma-bio-client");
const prisma = new PrismaClient();

async function main() {
  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  const userCount = await prisma.user.count({ where: { role: "user" } });

  console.log("Usuários admin:", adminCount);
  console.log("Usuários não-admin (serão excluídos):", userCount);

  if (userCount === 0) {
    console.log("Nenhum usuário não-admin para excluir.");
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { role: "user" },
  });

  console.log("Excluídos:", result.count, "usuário(s).");
  console.log("Restaram apenas os admins.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
