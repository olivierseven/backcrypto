export const dynamic = "force-dynamic";

export default function CryptoDevHomePage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-lg font-semibold">Crypto — dev</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Rotas sob <code className="rounded bg-zinc-100 px-1 py-0.5">/crypto/dev</code> só respondem em{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5">next dev</code> ou preview; em produção na Vercel
        devolvem 404. Não indexado (robots + meta).
      </p>
    </main>
  );
}
