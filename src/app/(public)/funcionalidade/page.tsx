import { redirect } from "next/navigation";

/** Redireciona para versão com locale na path (pt padrão). */
export default function FuncionalidadeLegacyPage() {
  redirect("/pt/funcionalidade");
}
