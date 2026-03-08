import { cryptoPrisma } from "@/lib/crypto-db";
import ExpandableCreditsList from "@/app/components/ExpandableCreditsList";
import { getCryptoT, type CryptoLang } from "@/app/lib/translations";

export default async function CryptoActiveCredits({ userId, lang = "pt" }: { userId: string; lang?: CryptoLang }) {
  const t = getCryptoT(lang);
  const locale = lang === "en" ? "en-US" : "pt-BR";

  function fmtNum(n: number) {
    return n.toLocaleString(locale);
  }
  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString(locale);
  }
  const now = new Date();

  const rows = await cryptoPrisma.walletCredit.findMany({
    where: { userId, expiresAt: { gt: now } },
    select: { id: true, amount: true, consumed: true, expiresAt: true, createdAt: true },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });

  const credits = rows
    .map((c) => ({
      id: c.id,
      amount: c.amount,
      consumed: c.consumed,
      remaining: Math.max(0, c.amount - c.consumed),
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    }))
    .filter((c) => c.remaining > 0);

  if (credits.length === 0) return null;

  const totalRemaining = credits.reduce((acc, c) => acc + c.remaining, 0);
  const lastExpiry = credits[credits.length - 1]?.expiresAt;
  const daysUntilLastExpiry = lastExpiry
    ? Math.ceil((lastExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const soonSum = credits.filter((c) => c.expiresAt <= soonThreshold).reduce((a, b) => a + b.remaining, 0);

  const clientCredits = credits.map((c) => ({
    ...c,
    expiresAt: c.expiresAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));

  const c = t.historico.credits;

  return (
    <div className="card-crypto-generator crypto-card rounded-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{c.title}</h2>
          <p className="text-sm text-zinc-600">
            {c.youHave} <b>{fmtNum(totalRemaining)}</b> {c.coinsWithValidity}
            {lastExpiry && daysUntilLastExpiry > 0 ? (
              <> {c.allExpireIn} <b>{daysUntilLastExpiry} {daysUntilLastExpiry === 1 ? c.day : c.days}</b>.</>
            ) : lastExpiry ? (
              <> {c.allExpireBy} <b>{fmtDate(lastExpiry)}</b>.</>
            ) : null}
          </p>
          {soonSum > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-800">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-sm">
                <b>{fmtNum(soonSum)}</b> coin{soonSum === 1 ? "" : "s"} {c.expireIn7Days}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <ExpandableCreditsList
          credits={clientCredits}
          translations={{
            package: c.package,
            remaining: c.remaining,
            expiresAt: c.expiresAt,
            seeLess: c.seeLess,
            seeAll: c.seeAll,
            remainingPct: c.remainingPct,
          }}
          locale={locale}
        />
      </div>
    </div>
  );
}
