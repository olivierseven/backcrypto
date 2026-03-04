"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/app/constants";

interface Props {
  userId: string;
  userEmail: string;
}

interface FoundUser {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  tier: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: string;
}

interface SavesReportRow {
  id: string;
  idShort: string;
  name: string;
  configBytes: number;
  configKb: number;
  createdAt: string;
}

interface SavesReportData {
  userId: string;
  rows: SavesReportRow[];
  totalBytes: number;
  totalKb: number;
  averageBytes: number;
  averageKb: number;
  count: number;
}

const BIO_WELCOME_COINS = 3000;
const BIO_WELCOME_DURATION_DAYS = 7;

export default function BioAdminClient({ userId, userEmail }: Props) {
  const router = useRouter();

  // Pacote de boas-vindas
  const [welcomeSearchUserId, setWelcomeSearchUserId] = useState("");
  const [welcomeSearchEmail, setWelcomeSearchEmail] = useState("");
  const [welcomeFoundUser, setWelcomeFoundUser] = useState<FoundUser | null>(null);
  const [welcomeSearchLoading, setWelcomeSearchLoading] = useState(false);
  const [welcomePackageLoading, setWelcomePackageLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");

  // Deletar usuário
  const [searchUserId, setSearchUserId] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  // Relatório de saves por usuário
  const [reportUserId, setReportUserId] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<SavesReportData | null>(null);
  const [reportError, setReportError] = useState("");

  const apiFetch = (path: string, opts?: RequestInit) =>
    fetch(`${API_BASE}/admin/${path}`, { ...opts, credentials: "include" });

  return (
    <div className="space-y-6">
      <div className="p-4 bg-zinc-100 rounded-xl">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">👤 Administrador</h2>
        <p className="text-sm text-zinc-700"><strong>Email:</strong> {userEmail}</p>
        <p className="text-xs text-zinc-500 mt-1"><strong>ID:</strong> {userId.slice(0, 12)}...</p>
      </div>

      {/* Pacote de boas-vindas */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <h2 className="text-lg font-semibold text-emerald-900 mb-4">🎁 Atribuir pacote de boas-vindas</h2>
        <p className="text-sm text-emerald-800 mb-4">
          Busque um usuário por ID ou email e atribua o pacote de boas-vindas ({BIO_WELCOME_COINS.toLocaleString("pt-BR")} coins, válido por {BIO_WELCOME_DURATION_DAYS} dias).
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">User ID</label>
              <input
                type="text"
                value={welcomeSearchUserId}
                onChange={(e) => {
                  setWelcomeSearchUserId(e.target.value);
                  setWelcomeSearchEmail("");
                  setWelcomeFoundUser(null);
                }}
                placeholder="clxxx..."
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
              <input
                type="email"
                value={welcomeSearchEmail}
                onChange={(e) => {
                  setWelcomeSearchEmail(e.target.value);
                  setWelcomeSearchUserId("");
                  setWelcomeFoundUser(null);
                }}
                placeholder="usuario@exemplo.com"
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              if (!welcomeSearchUserId && !welcomeSearchEmail) {
                setWelcomeMessage("❌ Informe User ID ou Email");
                return;
              }
              setWelcomeSearchLoading(true);
              setWelcomeMessage("");
              setWelcomeFoundUser(null);
              try {
                const res = await apiFetch("find-user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: welcomeSearchUserId || undefined,
                    email: welcomeSearchEmail || undefined,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setWelcomeFoundUser(data.user);
                  setWelcomeMessage("✅ Usuário encontrado!");
                } else {
                  setWelcomeMessage(`❌ ${data.error || "Erro ao buscar"}`);
                }
              } catch {
                setWelcomeMessage("❌ Erro ao buscar usuário");
              } finally {
                setWelcomeSearchLoading(false);
              }
            }}
            disabled={welcomeSearchLoading || (!welcomeSearchUserId && !welcomeSearchEmail)}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg"
          >
            {welcomeSearchLoading ? "⏳ Buscando..." : "🔍 Buscar usuário"}
          </button>

          {welcomeFoundUser && (
            <div className="p-4 bg-white rounded-lg border border-emerald-200">
              <h3 className="font-semibold text-zinc-900 mb-3">👤 {welcomeFoundUser.email}</h3>
              <p className="text-sm text-zinc-600 mb-3">ID: {welcomeFoundUser.id}</p>
              <button
                onClick={async () => {
                  setWelcomePackageLoading(true);
                  setWelcomeMessage("");
                  try {
                    const res = await apiFetch("welcome-package", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: welcomeFoundUser.id }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setWelcomeMessage(`✅ ${data.message} (${data.data.coins} coins, ${data.data.durationDays} dias)`);
                      setWelcomeFoundUser(null);
                      setWelcomeSearchUserId("");
                      setWelcomeSearchEmail("");
                    } else {
                      setWelcomeMessage(`❌ ${data.error || "Erro"}`);
                    }
                  } catch {
                    setWelcomeMessage("❌ Erro ao criar pacote");
                  } finally {
                    setWelcomePackageLoading(false);
                  }
                }}
                disabled={welcomePackageLoading}
                className="w-full px-6 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-lg"
              >
                {welcomePackageLoading ? "⏳ Criando..." : "🎁 Atribuir pacote"}
              </button>
            </div>
          )}

          {welcomeMessage && (
            <div className={`p-3 rounded-lg text-sm ${welcomeMessage.includes("✅") ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              {welcomeMessage}
            </div>
          )}
        </div>
      </div>

      {/* Relatório de saves por usuário */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl">
        <h2 className="text-lg font-semibold text-sky-900 mb-4">📊 Relatório de saves (tamanho no banco)</h2>
        <p className="text-sm text-sky-800 mb-4">
          Informe o User ID para ver quanto cada save ocupa por linha (coluna config), total e média.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">User ID</label>
            <input
              type="text"
              value={reportUserId}
              onChange={(e) => {
                setReportUserId(e.target.value.trim());
                setReportData(null);
                setReportError("");
              }}
              placeholder="cmlpo7108000ctnkkyu9idg1o"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={async () => {
              if (!reportUserId) {
                setReportError("Informe o User ID");
                return;
              }
              setReportLoading(true);
              setReportData(null);
              setReportError("");
              try {
                const res = await apiFetch("saves-report", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: reportUserId }),
                });
                const data = await res.json();
                if (res.ok) {
                  setReportData(data);
                } else {
                  setReportError(data.error || "Erro ao buscar relatório");
                }
              } catch {
                setReportError("Erro ao buscar relatório");
              } finally {
                setReportLoading(false);
              }
            }}
            disabled={reportLoading || !reportUserId}
            className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-lg"
          >
            {reportLoading ? "⏳ Gerando..." : "📊 Ver relatório"}
          </button>

          {reportError && (
            <div className="p-3 rounded-lg text-sm bg-red-100 text-red-800">
              {reportError}
            </div>
          )}

          {reportData && (
            <div className="overflow-x-auto">
              <p className="text-sm text-sky-800 mb-2">
                Usuário: <strong>{reportData.userId}</strong> • Total de saves: <strong>{reportData.count}</strong>
              </p>
              {reportData.count === 0 ? (
                <p className="p-4 bg-zinc-100 rounded-lg text-zinc-600">Nenhum save encontrado para este usuário.</p>
              ) : (
                <>
                  <table className="w-full text-sm border border-zinc-300 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-zinc-200 text-zinc-800">
                        <th className="text-left p-2 border-b border-zinc-300">id (curtado)</th>
                        <th className="text-left p-2 border-b border-zinc-300">name</th>
                        <th className="text-right p-2 border-b border-zinc-300">config (bytes)</th>
                        <th className="text-right p-2 border-b border-zinc-300">config (KB)</th>
                        <th className="text-left p-2 border-b border-zinc-300">createdAt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map((row) => (
                        <tr key={row.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                          <td className="p-2 font-mono text-xs">{row.idShort}</td>
                          <td className="p-2">{row.name || "—"}</td>
                          <td className="p-2 text-right font-mono">{row.configBytes.toLocaleString("pt-BR")}</td>
                          <td className="p-2 text-right font-mono">{row.configKb.toFixed(2)}</td>
                          <td className="p-2">{row.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 p-4 bg-white rounded-lg border border-sky-200 text-sm">
                    <p><strong>Total (só coluna config):</strong> {reportData.totalBytes.toLocaleString("pt-BR")} bytes ({reportData.totalKb.toFixed(2)} KB)</p>
                    <p className="mt-1"><strong>Média por linha:</strong> {reportData.averageBytes.toLocaleString("pt-BR")} bytes ({reportData.averageKb.toFixed(2)} KB)</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deletar usuário */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <h2 className="text-lg font-semibold text-red-900 mb-4">🗑️ Excluir usuário</h2>
        <p className="text-sm text-red-800 mb-4">
          Busque por ID ou email e exclua permanentemente. Esta ação é irreversível!
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">User ID</label>
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => {
                  setSearchUserId(e.target.value);
                  setSearchEmail("");
                  setFoundUser(null);
                }}
                placeholder="clxxx..."
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => {
                  setSearchEmail(e.target.value);
                  setSearchUserId("");
                  setFoundUser(null);
                }}
                placeholder="usuario@exemplo.com"
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              if (!searchUserId && !searchEmail) {
                setDeleteMessage("❌ Informe User ID ou Email");
                return;
              }
              setSearchLoading(true);
              setDeleteMessage("");
              setFoundUser(null);
              try {
                const res = await apiFetch("find-user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: searchUserId || undefined,
                    email: searchEmail || undefined,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setFoundUser(data.user);
                  setDeleteMessage("✅ Usuário encontrado!");
                } else {
                  setDeleteMessage(`❌ ${data.error || "Erro ao buscar"}`);
                }
              } catch {
                setDeleteMessage("❌ Erro ao buscar usuário");
              } finally {
                setSearchLoading(false);
              }
            }}
            disabled={searchLoading || (!searchUserId && !searchEmail)}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg"
          >
            {searchLoading ? "⏳ Buscando..." : "🔍 Buscar usuário"}
          </button>

          {foundUser && (
            <div className="p-4 bg-white rounded-lg border border-red-200">
              <h3 className="font-semibold text-zinc-900 mb-2">👤 {foundUser.email}</h3>
              <p className="text-sm text-zinc-600">ID: {foundUser.id} • Role: {foundUser.role}</p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => {
                    if (foundUser.id === userId) {
                      setDeleteMessage("❌ Você não pode excluir sua própria conta");
                      return;
                    }
                    if (foundUser.role === "admin") {
                      setDeleteMessage("❌ Não é possível excluir outro administrador");
                      return;
                    }
                    setShowDeleteConfirm(true);
                  }}
                  disabled={foundUser.id === userId || foundUser.role === "admin"}
                  className="mt-4 w-full px-6 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-semibold rounded-lg"
                >
                  🗑️ Excluir usuário
                </button>
              ) : (
                <div className="mt-4 p-4 bg-red-100 rounded-lg border-2 border-red-400">
                  <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Confirmação necessária</p>
                  <p className="text-sm text-red-800 mb-4">Tem certeza? Esta ação é IRREVERSÍVEL.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setDeleteLoading(true);
                        setDeleteMessage("");
                        try {
                          const res = await apiFetch("delete-user", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: foundUser.id }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setDeleteMessage("✅ Usuário excluído!");
                            setFoundUser(null);
                            setSearchUserId("");
                            setSearchEmail("");
                            setShowDeleteConfirm(false);
                          } else {
                            setDeleteMessage(`❌ ${data.error || "Erro"}`);
                          }
                        } catch {
                          setDeleteMessage("❌ Erro ao excluir");
                        } finally {
                          setDeleteLoading(false);
                        }
                      }}
                      disabled={deleteLoading}
                      className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-semibold rounded-lg"
                    >
                      {deleteLoading ? "⏳ Excluindo..." : "✅ Confirmar"}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteMessage("");
                      }}
                      disabled={deleteLoading}
                      className="flex-1 px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white font-semibold rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {deleteMessage && (
            <div className={`p-3 rounded-lg text-sm ${deleteMessage.includes("✅") ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              {deleteMessage}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800">
          ⚠️ Esta área é restrita. Use com cuidado ao alterar configurações de usuários.
        </p>
      </div>
    </div>
  );
}
