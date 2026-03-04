/**
 * Script temporário: quanto cada save do usuário ocupa por linha no banco.
 * Uso: node scripts/size-saves-user.js
 * Requer BG_DATABASE_URL no .env (ou carregar .env manualmente).
 */
const path = require("path");
const fs = require("fs");

// Carregar .env da raiz do projeto
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const userId = "cmlpo7108000ctnkkyu9idg1o";
const { PrismaClient } = require("../src/lib/prisma-bio-client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.bioSavedConfig.findMany({
    where: { userId },
    select: { id: true, name: true, config: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log(`Nenhum save encontrado para o usuário ${userId}`);
    return;
  }

  console.log(`\nUsuário: ${userId}`);
  console.log(`Total de saves: ${rows.length}\n`);
  console.log("id (curtado)     | name (curtado)     | config (bytes) | config (KB)  | createdAt");
  console.log("-".repeat(95));

  let totalBytes = 0;
  for (const row of rows) {
    const configStr = JSON.stringify(row.config);
    const bytes = Buffer.byteLength(configStr, "utf8");
    totalBytes += bytes;
    const idShort = row.id.length > 14 ? row.id.slice(0, 14) + "…" : row.id;
    const nameShort = (row.name || "").length > 18 ? (row.name || "").slice(0, 18) + "…" : (row.name || "");
    const date = row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "";
    console.log(
      `${idShort.padEnd(16)} | ${nameShort.padEnd(19)} | ${String(bytes).padStart(14)} | ${(bytes / 1024).toFixed(2).padStart(11)} | ${date}`
    );
  }

  console.log("-".repeat(95));
  console.log(`Total (só coluna config): ${totalBytes.toLocaleString()} bytes (${(totalBytes / 1024).toFixed(2)} KB)`);
  console.log(`Média por linha:          ${Math.round(totalBytes / rows.length).toLocaleString()} bytes (${(totalBytes / rows.length / 1024).toFixed(2)} KB)`);
  console.log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
