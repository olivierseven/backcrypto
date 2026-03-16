/**
 * Dump completo (schema + dados) do banco de DEV.
 * Usa DATABASE_URL ou URL_DEV do .env. Nada pode faltar.
 *
 * Restaurar em produção: psql "<URL_PROD>" < dump.sql
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

let url = process.env.DATABASE_URL || process.env.URL_DEV;
if (!url && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (key === 'DATABASE_URL' || key === 'URL_DEV') url = url || val;
  }
}
if (!url) {
  console.error('DATABASE_URL ou URL_DEV não encontrada no .env');
  process.exit(1);
}

// Ordem para INSERT: respeita FKs (pais antes de filhos)
const TABLE_ORDER = [
  'User',
  'ChartLayout',
  'ChartModels',
  'UserNotification',
  'AccessRequest',
  'EmailVerificationToken',
  'PasswordResetToken',
  'UserCoinWallet',
  'CoinLedgerEntry',
  'WalletCredit',
  'StripeEvent',
  'StripeCheckoutSession',
  'PagarMeOrder',
  'BinanceKline',
  'BinanceKlineFast',
  'BinanceKlineCache',
  'BinanceKlineGap',
];

function escapeVal(v) {
  if (v === null) return 'NULL';
  if (typeof v === 'undefined') return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  if (Buffer.isBuffer(v)) return "'" + v.toString('hex').replace(/'/g, "''") + "'";
  if (v instanceof Date) return "'" + v.toISOString().replace(/T/, ' ').replace(/\.\d{3}Z/, '') + "'";
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
  const s = String(v);
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

async function main() {
  console.log('1/2 Schema (Prisma)...');
  const schemaSql = execSync(
    'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );

  const client = new Client({ connectionString: url });
  await client.connect();

  const tablesResult = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'backcrypto'
    ORDER BY tablename
  `);
  const allTables = tablesResult.rows.map((r) => r.tablename);
  const ordered = [];
  for (const t of TABLE_ORDER) {
    if (allTables.includes(t)) ordered.push(t);
  }
  for (const t of allTables) {
    if (!ordered.includes(t)) ordered.push(t);
  }

  const lines = [
    '-- Dump completo: schema + dados (todas as colunas, todas as tabelas)',
    schemaSql.trim(),
    '',
    '-- ========== DADOS ==========',
    '',
  ];

  console.log('2/2 Dados (todas as tabelas, todas as colunas)...');
  for (const tablename of ordered) {
    const fullName = `"backcrypto"."${tablename}"`;
    const colsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'backcrypto' AND table_name = $1
      ORDER BY ordinal_position
    `, [tablename]);
    const colNames = colsResult.rows.map((r) => r.column_name);
    if (colNames.length === 0) {
      lines.push(`-- ${tablename}: sem colunas (ignorado)`);
      continue;
    }
    const colsList = colNames.map((c) => `"${c}"`).join(', ');
    const res = await client.query(`SELECT * FROM ${fullName}`);

    lines.push(`-- ${tablename} (${colNames.length} colunas, ${res.rows.length} linhas)`);
    if (res.rows.length === 0) {
      lines.push('');
      continue;
    }
    for (const row of res.rows) {
      const vals = colNames.map((col) => escapeVal(row[col]));
      lines.push(`INSERT INTO ${fullName} (${colsList}) VALUES (${vals.join(', ')});`);
    }
    lines.push('');
  }

  await client.end();

  const outPath = path.join(root, 'dump.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('dump.sql criado em', outPath);
  console.log('Restaurar: psql "<URL_PROD>" < dump.sql');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
