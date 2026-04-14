import { requireAdmin } from "@/lib/admin-protection";
import CryptoAdminClient from "./CryptoAdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const adminUser = await requireAdmin();

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="card-crypto-generator rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-zinc-900 mb-6">
            🔑 Painel de Administração
          </h1>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              ⚠️ Área restrita para administradores
            </p>
          </div>

          <CryptoAdminClient
            userId={adminUser.id}
            userEmail={adminUser.email || adminUser.name}
          />
        </div>
      </div>
    </main>
  );
}
