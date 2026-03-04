import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { bioPrisma } from "@/lib/bio-db";
import { jwtVerify } from "jose";
import BioActiveCredits from "./BioActiveCredits";
import { APP_BACKCRYPTO_ROUTE_PREFIX, APP_BACKCRYPTO_SISTEMA_PATH, SISTEMA_PATH } from "@/app/constants";
import { getRedirectOriginFromHeaders } from "@/lib/redirect-origin";
import { getBioT, type BioLang } from "@/app/lib/translations";
import BioHeaderSafe from "@/app/BioHeaderSafe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PAGE_SIZE = 6;

function fmtDate(d: Date, locale: string) {
  try {
    return new Date(d).toLocaleString(locale);
  } catch {
    return "";
  }
}

function sourceLabel(s: string, t: ReturnType<typeof getBioT>["historico"]["sources"]) {
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
  const headersList = await headers();
  const origin = getRedirectOriginFromHeaders(headersList);
  const loginUrl = origin ? `${origin}${APP_BACKCRYPTO_ROUTE_PREFIX}/login` : `${APP_BACKCRYPTO_ROUTE_PREFIX}/login`;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) redirect(`${loginUrl}?next=${APP_BACKCRYPTO_ROUTE_PREFIX}/historico`);

  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    redirect(loginUrl);
  }

  const userId = typeof payload?.sub === "string" ? payload.sub : undefined;
  if (!userId) redirect(loginUrl);

  const sp = await searchParams;
  const rawPage = Number(sp?.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const [totalCount, entries, wallet, user] = await Promise.all([
    bioPrisma.coinLedgerEntry.count({ where: { userId } }),
    bioPrisma.coinLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    bioPrisma.userCoinWallet.findUnique({ where: { userId } }),
    bioPrisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const balance = wallet?.balance ?? 0;
  const lang = (user?.language ?? "en") as BioLang;
  const t = getBioT(lang);
  const locale = lang === "en" ? "en-US" : "pt-BR";

  return (
    <main className="bio-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <BioHeaderSafe>
      <header className="bio-header sticky top-0 z-10 shrink-0 w-full">
        <div className="bio-header-inner mx-auto max-w-2xl px-4 sm:px-6">
          <Link
            href={SISTEMA_PATH}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            {t.historico.backToSystem}
          </Link>
          <span className="text-sm font-semibold text-neutral-800">{t.historico.title}</span>
          <span className="text-sm font-medium text-neutral-700 shrink-0">{balance.toLocaleString(locale)} coins</span>
        </div>
      </header>
      </BioHeaderSafe>

      <div className="bio-wrap relative mx-auto w-full max-w-2xl flex-1 px-6 py-0 sm:px-8">
        <div className="w-full">
          <BioActiveCredits userId={userId} lang={lang} />

          <div className="card-bio-generator bio-card rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{t.historico.transactions}</h2>
                <p className="text-sm text-zinc-600">{t.historico.sortDesc}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="bio-historico-table w-full text-sm">
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
                      const positive = e.amount > 0;
                      const sign = positive ? "+" : "";
                      return (
                        <tr key={e.id}>
                          <td className="py-2 text-purple-800">{fmtDate(e.createdAt, locale)}</td>
                          <td className="py-2 text-purple-900 font-medium">{e.type}</td>
                          <td className="py-2 text-purple-800">{sourceLabel(String(e.source), t.historico.sources)}</td>
                          <td className={"py-2 text-right font-semibold " + (positive ? "text-emerald-700" : "text-amber-700")}>
                            {sign}{e.amount.toLocaleString(locale)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-neutral-200">
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

function Pager({ page, totalPages, t }: { page: number; totalPages: number; t: ReturnType<typeof getBioT>["historico"] }) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <div className="flex items-center gap-4">
      <Link
        href={hasPrev ? qlink(page - 1) : "#"}
        aria-disabled={!hasPrev}
        className={
          "bio-btn rounded-lg border text-sm " +
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
          "bio-btn rounded-lg border text-sm " +
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
