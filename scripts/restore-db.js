/**
 * Restaura dump.sql no banco de produção (URL_PROD do .env).
 * Não precisa do psql instalado.
 *
 * Uso: node scripts/restore-db.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const dumpPath = path.join(root, 'dump.sql');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (['URL_PROD', 'DATABASE_URL_PRODUCAO'].includes(key)) process.env.URL_PROD = process.env.URL_PROD || val;
  }
}
loadEnv();

const url = process.env.URL_PROD || process.env.DATABASE_URL_PRODUCAO;
if (!url) {
  console.error('URL_PROD não encontrada no .env');
  process.exit(1);
}
if (!fs.existsSync(dumpPath)) {
  console.error('dump.sql não encontrado em', dumpPath);
  process.exit(1);
}

const sql = fs.readFileSync(dumpPath, 'utf8');
// Separa por ; no fim de linha
const statements = sql
  .split(/;\s*[\r\n]+/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const BATCH_SIZE = 2000; // vários INSERTs por round-trip

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('Restaurando em produção (transação única + batch)...');
  await client.query('BEGIN');
  let done = 0;
  let i = 0;
  while (i < statements.length) {
    const batch = [];
    const end = Math.min(i + BATCH_SIZE, statements.length);
    for (let j = i; j < end; j++) {
      const st = statements[j];
      batch.push(st.endsWith(';') ? st : st + ';');
    }
    const batchSql = batch.join('\n');
    try {
      await client.query(batchSql);
    } catch (err) {
      if (err.code === '42P07' || err.code === '42710') {
        i = end;
        done += batch.length;
        continue;
      }
      console.error('Erro:', err.message);
      console.error('Statement (primeiros 80 chars):', batchSql.slice(0, 80) + '...');
      await client.query('ROLLBACK');
      await client.end();
      process.exit(1);
    }
    done += batch.length;
    i = end;
    if (done % 5000 === 0) console.log(done, 'statements...');
  }
  await client.query('COMMIT');
  await client.end();
  console.log('Restauração concluída.', done, 'statements.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
