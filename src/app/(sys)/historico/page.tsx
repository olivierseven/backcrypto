import Link from "next/link";
import { cryptoPrisma } from "@/lib/crypto-db";
import CryptoActiveCredits from "./CryptoActiveCredits";
import { APP_CRYPTO_ROUTE_PREFIX, APP_CRYPTO_SISTEMA_PATH, SISTEMA_PATH } from "@/app/constants";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";
import { requireSysUserId } from "../require-sys-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 6;

function fmtDate(d: Date, locale: string) {
  try {
    return new Date(d).toLocaleString(locale);
  } catch {
    return "";
  }
}

function sourceLabel(s: string, t: ReturnType<typeof getCryptoT>["historico"]["sources"]) {
  const key = s as keyof typeof t;
  return (t as Record<string, string>)[key] ?? s;
}

function qlink(page: number) {
  return `?page=${page}`;
}

export default async function BioHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const userId = await requireSysUserId(`${APP_CRYPTO_ROUTE_PREFIX}/historico`);

  const sp = await searchParams;
  const rawPage = Number(sp?.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const [totalCount, entries, wallet, user] = await Promise.all([
    cryptoPrisma.coinLedgerEntry.count({ where: { userId } }),
    cryptoPrisma.coinLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: { id: true, type: true, source: true, amount: true, createdAt: true, meta: true },
    }),
    cryptoPrisma.userCoinWallet.findUnique({ where: { userId } }),
    cryptoPrisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const balance = wallet?.balance ?? 0;
  const lang = (user?.language ?? "en") as CryptoLang;
  const t = getCryptoT(lang);
  const locale = lang === "en" ? "en-US" : "pt-BR";

  return (
    <main className="crypto-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="crypto-wrap relative mx-auto w-full max-w-2xl flex-1 px-6 py-0 sm:px-8">
        <div className="w-full">
          <CryptoActiveCredits userId={userId} lang={lang} />

          <div className="card-crypto-generator crypto-card rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{t.historico.transactions}</h2>
                <p className="text-sm text-zinc-600">{t.historico.sortDesc}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="crypto-historico-table w-full text-sm">
                <thead>
                  <tr className="bg-purple-100">
                    <Th>{t.historico.date}</Th>
                    <Th>{t.historico.type}</Th>
                    <Th>{t.historico.source}</Th>
                    <Th className="text-right">{t.historico.value}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-200">
                  {entries.length === 0 ? (
                    <tr>
                      <td className="py-6 text-purple-800" colSpan={4}>
                        {t.historico.noTransactions}
                        <Link href={SISTEMA_PATH} className="ml-2 underline hover:no-underline">{t.historico.backToSystemLink}</Link>
                      </td>
                    </tr>
                  ) : (
                    entries.map((e) => {
                      const meta = e.meta as { reason?: string; cancelledAt?: string } | null;
                      const isCancellation = meta?.reason === "subscription_cancelled";
                      if (isCancellation) {
                        const cancelDate = meta?.cancelledAt ? fmtDate(new Date(meta.cancelledAt), locale) : fmtDate(e.createdAt, locale);
                        return (
                          <tr key={e.id}>
                            <td className="py-2 text-purple-800">{cancelDate}</td>
                            <td className="py-2 text-purple-900 font-medium">{t.historico.typeCancellation}</td>
                            <td className="py-2 text-purple-800">{t.historico.sourceCancellation}</td>
                            <td className="py-2 text-right text-zinc-600">—</td>
                          </tr>
                        );
                      }
                      const isTrialOrAdminAccess =
                        meta?.reason === "lite_trial_first_login" ||
                        meta?.reason === "welcome_package_crypto" ||
                        meta?.reason === "admin_access";
                      const displayAmount = isTrialOrAdminAccess ? 0 : e.amount;
                      const positive = displayAmount > 0;
                      const sign = positive ? "+" : "";
                      return (
                        <tr key={e.id}>
                          <td className="py-2 text-purple-800">{fmtDate(e.createdAt, locale)}</td>
                          <td className="py-2 text-purple-900 font-medium">{e.type}</td>
                          <td className="py-2 text-purple-800">{sourceLabel(String(e.source), t.historico.sources)}</td>
                          <td className={"py-2 text-right font-semibold " + (positive ? "text-emerald-700" : "text-amber-700")}>
                            {sign}{displayAmount.toLocaleString(locale)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-zinc-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  {t.historico.showing} {entries.length} {t.historico.of} {totalCount.toLocaleString(locale)}
                </div>
                <Pager page={page} totalPages={totalPages} t={t.historico} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={"px-3 py-2 text-left font-semibold text-purple-900 " + className}>
      {children}
    </th>
  );
}

function Pager({ page, totalPages, t }: { page: number; totalPages: number; t: ReturnType<typeof getCryptoT>["historico"] }) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <div className="flex items-center gap-4">
      <Link
        href={hasPrev ? qlink(page - 1) : "#"}
        aria-disabled={!hasPrev}
        className={
          "crypto-btn rounded-lg border text-sm " +
          (hasPrev
            ? "border-neutral-200 bg-white hover:bg-neutral-50 text-zinc-900"
            : "border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed pointer-events-none")
        }
      >
        {t.previous}
      </Link>
      <span className="text-sm text-zinc-600">
        {t.page} <span className="font-medium text-zinc-900">{page}</span> / <span className="font-medium text-zinc-900">{totalPages}</span>
      </span>
      <Link
        href={hasNext ? qlink(page + 1) : "#"}
        aria-disabled={!hasNext}
        className={
          "crypto-btn rounded-lg border text-sm " +
          (hasNext
            ? "border-neutral-200 bg-white hover:bg-neutral-50 text-zinc-900"
            : "border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed pointer-events-none")
        }
      >
        {t.next}
      </Link>
    </div>
  );
}
