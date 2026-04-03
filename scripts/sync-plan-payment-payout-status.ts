/**
 * CLI — mesmas opções que o .js antigo, mais --id-afiliado=<AffiliateAccount.id>
 *
 * Uso: npx tsx scripts/sync-plan-payment-payout-status.ts [--dry-run] [--id-afiliado=...] ...
 */
import { syncPlanPaymentPayouts } from "../src/lib/sync-stripe-plan-payment-payout";

function createdAtGteTwoMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out: {
    dryRun: boolean;
    limit: number;
    only: "stripe" | "pagarme" | null;
    sinceDays: number | null;
    id: string | null;
    idAfiliado: string | null;
    allCreated: boolean;
  } = { dryRun: false, limit: 200, only: null, sinceDays: null, id: null, idAfiliado: null, allCreated: false };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--all-created") out.allCreated = true;
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, parseInt(a.slice(8), 10) || 200);
    else if (a.startsWith("--only=")) out.only = a.slice(7).toLowerCase() as "stripe" | "pagarme";
    else if (a.startsWith("--since-days=")) out.sinceDays = Math.max(1, parseInt(a.slice(13), 10) || 30);
    else if (a.startsWith("--id=")) out.id = a.slice(5).trim();
    else if (a.startsWith("--id-afiliado=")) out.idAfiliado = a.slice("--id-afiliado=".length).trim();
  }
  if (out.only && !["stripe", "pagarme"].includes(out.only)) {
    console.error("--only deve ser stripe ou pagarme");
    process.exit(1);
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido (.env)");
    process.exit(1);
  }

  const opts = parseArgs();
  const createdAtCutoff = createdAtGteTwoMonthsAgo();
  const windowMsg = opts.allCreated
    ? "created_at: sem limite (--all-created)"
    : `created_at >= ${createdAtCutoff.toISOString()}`;

  console.log(
    `Sincronização (dry-run=${opts.dryRun}) | ${windowMsg}${opts.idAfiliado ? ` | id_afiliado=${opts.idAfiliado}` : ""}`,
  );

  const result = await syncPlanPaymentPayouts({
    dryRun: opts.dryRun,
    limit: opts.limit,
    only: opts.only,
    sinceDays: opts.sinceDays,
    rowId: opts.id,
    idAfiliado: opts.idAfiliado,
    allCreated: opts.allCreated,
  });

  console.log(`Linhas processadas: ${result.rowCount}`);
  console.log(`Concluído. Atualizados: ${result.updated}, erros: ${result.errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
