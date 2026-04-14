/**
 * Backfill de StripePlanPayment.amount_affiliate_cents / currency_affiliate.
 *
 * Regras:
 * - locale do afiliado (AffiliateApplication.locale):
 *   - pt / pt-br -> BRL
 *   - outros -> USD
 * - sem afiliado (id_afiliado vazio): mantém moeda original da linha.
 *
 * Uso:
 *   npx tsx scripts/backfill-affiliate-payment-currency.ts --dry-run
 *   npx tsx scripts/backfill-affiliate-payment-currency.ts --limit=500
 *   npx tsx scripts/backfill-affiliate-payment-currency.ts --id-afiliado=AFI_...
 */
import { cryptoPrisma } from "../src/lib/crypto-db";
import { getUsdToBrlRate } from "../src/lib/usd-brl-rate";

type Cur = "usd" | "brl";

function parseArgs() {
  const argv = process.argv.slice(2);
  const out: { dryRun: boolean; limit: number; idAfiliado: string | null } = {
    dryRun: false,
    limit: 300,
    idAfiliado: null,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--limit=")) out.limit = Math.max(1, parseInt(a.slice(8), 10) || 300);
    else if (a.startsWith("--id-afiliado=")) out.idAfiliado = a.slice("--id-afiliado=".length).trim() || null;
  }
  return out;
}

function normalizeCurrency(v: string | null | undefined): Cur | null {
  const s = (v || "").trim().toLowerCase();
  if (s === "usd") return "usd";
  if (s === "brl") return "brl";
  return null;
}

function convertCents(amountCents: number, from: Cur, to: Cur, usdToBrl: number): number {
  if (from === to) return amountCents;
  if (from === "usd" && to === "brl") return Math.round((amountCents / 100) * usdToBrl * 100);
  return Math.round((amountCents / 100 / usdToBrl) * 100);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido");
    process.exit(1);
  }

  const opts = parseArgs();
  const where: {
    OR: Array<{ amountAffiliateCents: null } | { currencyAffiliate: null }>;
    idAfiliado?: string;
  } = {
    OR: [{ amountAffiliateCents: null }, { currencyAffiliate: null }],
  };
  if (opts.idAfiliado) where.idAfiliado = opts.idAfiliado;

  const rows = await cryptoPrisma.stripePlanPayment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: opts.limit,
    select: {
      id: true,
      idAfiliado: true,
      amountTotalCents: true,
      currency: true,
      amountAffiliateCents: true,
      currencyAffiliate: true,
    },
  });

  if (rows.length === 0) {
    console.log("Nenhuma linha para backfill.");
    return;
  }

  const idsAfiliado = [...new Set(rows.map((r) => r.idAfiliado.trim()).filter(Boolean))];
  const apps = idsAfiliado.length
    ? await cryptoPrisma.affiliateApplication.findMany({
        where: { idAfiliado: { in: idsAfiliado } },
        select: { idAfiliado: true, locale: true },
      })
    : [];
  const localeByAffiliate = new Map<string, string>();
  for (const a of apps) localeByAffiliate.set(a.idAfiliado, (a.locale || "").toLowerCase());

  const { rate: usdToBrl } = await getUsdToBrlRate();
  let updated = 0;
  let skippedCurrency = 0;

  console.log(`Backfill affiliate currency | dry-run=${opts.dryRun} | rows=${rows.length} | usd_brl=${usdToBrl}`);

  for (const r of rows) {
    const baseCur = normalizeCurrency(r.currency);
    if (!baseCur) {
      skippedCurrency++;
      continue;
    }
    const idAfiliado = r.idAfiliado.trim();
    const locale = idAfiliado ? localeByAffiliate.get(idAfiliado) || "" : "";
    const target: Cur = idAfiliado
      ? (locale === "pt" || locale === "pt-br" ? "brl" : "usd")
      : baseCur;
    const amountAffiliateCents = convertCents(r.amountTotalCents, baseCur, target, usdToBrl);

    if (!opts.dryRun) {
      await cryptoPrisma.stripePlanPayment.update({
        where: { id: r.id },
        data: {
          amountAffiliateCents,
          currencyAffiliate: target,
        },
      });
    }
    updated++;
  }

  console.log(`Concluído. updated=${updated} skipped_currency=${skippedCurrency}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await cryptoPrisma.$disconnect();
  });

