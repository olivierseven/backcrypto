import type { AffiliateBillingCompany } from "@/lib/affiliate-billing-company";

export default function AffiliateBillingCompanyCard({
  unlocked,
  billing,
  title,
  lockedHint,
  labels,
}: {
  unlocked: boolean;
  billing: AffiliateBillingCompany;
  title: string;
  lockedHint: string;
  labels: {
    cnpj: string;
    razaoSocial: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
  };
}) {
  return (
    <div className="card-crypto-generator crypto-card relative overflow-hidden">
      <h2 className="text-base font-semibold mb-3 text-zinc-900">{title}</h2>

      {!unlocked ? (
        <div
          className="relative rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-10 text-center"
          role="region"
          aria-label={title}
        >
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[6px] px-4"
            aria-hidden
          >
            <svg
              className="h-10 w-10 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="max-w-sm text-sm text-zinc-600 leading-relaxed">{lockedHint}</p>
          </div>
          <div className="select-none blur-md opacity-40" aria-hidden>
            <p className="font-mono text-sm">•••.•••.•••/••••-••</p>
            <p className="mt-2 text-sm">•••••••••••••••••••••••••</p>
          </div>
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.cnpj}</dt>
            <dd className="font-mono font-semibold text-right">{billing.cnpjFormatted}</dd>
          </div>
          <div className="flex justify-between gap-3 items-start">
            <dt className="text-zinc-700 shrink-0 pt-0.5">{labels.razaoSocial}</dt>
            <dd className="min-w-0 flex-1 text-right break-words font-medium">{billing.razaoSocial}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.cep}</dt>
            <dd className="font-mono text-right">{billing.cepFormatted}</dd>
          </div>
          <div className="flex justify-between gap-3 items-start">
            <dt className="text-zinc-700 shrink-0">{labels.logradouro}</dt>
            <dd className="text-right break-words">{billing.logradouro}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.numero}</dt>
            <dd className="text-right">{billing.numero}</dd>
          </div>
          <div className="flex justify-between gap-3 items-start">
            <dt className="text-zinc-700 shrink-0">{labels.complemento}</dt>
            <dd className="text-right break-words">{billing.complemento}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.bairro}</dt>
            <dd className="text-right">{billing.bairro}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.municipio}</dt>
            <dd className="text-right">{billing.municipio}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-700 shrink-0">{labels.uf}</dt>
            <dd className="text-right font-medium">{billing.uf}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
