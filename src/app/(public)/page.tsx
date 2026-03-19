import { redirect } from "next/navigation";

/** Público: idioma na URL — /crypto/pt e /crypto/en */
export default function PublicRootPage() {
  redirect("/pt");
}
