/**
 * Verifica se o schema Prisma (prisma/schema.prisma) contém tudo que existe
 * no banco (DATABASE_URL). Compara tabelas e colunas do schema backcrypto.
 *
 * Uso: node scripts/verify-schema-vs-db.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && m[1].trim() === 'DATABASE_URL') {
      url = m[2].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}
if (!url) {
  console.error('DATABASE_URL não encontrado no .env');
  process.exit(1);
}

const SCALAR_TYPES = new Set(['String', 'Int', 'Boolean', 'DateTime', 'Decimal', 'BigInt', 'Json', 'Float']);
const ENUMS = new Set(['Role', 'AppLanguage', 'Tier', 'UserLevel', 'TxType', 'TxSource', 'CheckoutStatus', 'SenderType']);

// Extrai do schema Prisma: tabelas e colunas (nome no banco). Ignora campos de relação.
function parsePrismaSchema() {
  const schemaPath = path.join(root, 'prisma', 'schema.prisma');
  const content = fs.readFileSync(schemaPath, 'utf8');
  const modelNames = new Set();
  content.replace(/^model\s+(\w+)\s*\{/gm, (_, n) => { modelNames.add(n); return ''; });
  const tables = {};
  let currentModel = null;
  let currentTableDb = null;
  let currentColumns = null;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      currentTableDb = currentModel;
      currentColumns = new Set();
      continue;
    }
    if (currentModel && line.includes('@@map(')) {
      const mapMatch = line.match(/@@map\s*\(\s*["']([^"']+)["']\s*\)/);
      if (mapMatch) currentTableDb = mapMatch[1];
      continue;
    }
    if (currentModel && line.includes('@@schema')) {
      tables[currentTableDb] = currentColumns;
      currentModel = null;
      currentTableDb = null;
      currentColumns = null;
      continue;
    }
    if (currentModel && currentColumns) {
      const fieldMatch = line.match(/^\s*(\w+)\s+(\w+)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        if (fieldName.startsWith('@@')) continue;
        if (modelNames.has(fieldType)) continue; // relação, não tem coluna
        if (!SCALAR_TYPES.has(fieldType) && !ENUMS.has(fieldType)) continue;
        let colDb = fieldName;
        const mapMatch = line.match(/@map\s*\(\s*["']([^"']+)["']\s*\)/);
        if (mapMatch) colDb = mapMatch[1];
        currentColumns.add(colDb);
      }
    }
  }
  return tables;
}

async function main() {
  const prismaTables = parsePrismaSchema();
  const client = new Client({ connectionString: url });
  await client.connect();

  const dbTables = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'backcrypto'
    ORDER BY table_name, ordinal_position
  `);

  const dbMap = {}; // table_name -> [columns]
  for (const row of dbTables.rows) {
    if (!dbMap[row.table_name]) dbMap[row.table_name] = [];
    dbMap[row.table_name].push(row.column_name);
  }

  let hasError = false;

  // 1) Tabelas no banco que não estão no Prisma
  for (const tableName of Object.keys(dbMap)) {
    if (!prismaTables[tableName]) {
      console.error('[FALTA NO PRISMA] Tabela no banco não existe no schema:', tableName);
      hasError = true;
    }
  }

  // 2) Colunas no banco que não estão no Prisma
  for (const [tableName, columns] of Object.entries(dbMap)) {
    const prismaCols = prismaTables[tableName];
    if (!prismaCols) continue;
    for (const col of columns) {
      if (!prismaCols.has(col)) {
        console.error('[FALTA NO PRISMA] Coluna no banco não existe no schema:', tableName + '.' + col);
        hasError = true;
      }
    }
  }

  // 3) Tabelas no Prisma que não estão no banco
  for (const tableName of Object.keys(prismaTables)) {
    if (!dbMap[tableName]) {
      console.error('[FALTA NO BANCO] Tabela no schema não existe no banco:', tableName);
      hasError = true;
    }
  }

  // 4) Colunas no Prisma que não estão no banco
  for (const [tableName, prismaCols] of Object.entries(prismaTables)) {
    const dbCols = dbMap[tableName];
    if (!dbCols) continue;
    const dbSet = new Set(dbCols);
    for (const col of prismaCols) {
      if (!dbSet.has(col)) {
        console.error('[FALTA NO BANCO] Coluna no schema não existe no banco:', tableName + '.' + col);
        hasError = true;
      }
    }
  }

  await client.end();

  if (hasError) {
    console.log('');
    console.log('Resumo: Prisma e banco estão DESALINHADOS. Corrija o schema ou rode migrações no banco.');
    process.exit(1);
  }
  console.log('OK: Prisma e banco (backcrypto) estão alinhados.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
