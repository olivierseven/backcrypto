import { redirect } from "next/navigation";
import { CRYPTO_DISCORD_INVITE_URL } from "@/app/lib/cryptoDiscordCommunityInvite";

/** /crypto/comunidade → Discord (link estável para partilhar). */
export default function ComunidadeRedirectPage() {
  redirect(CRYPTO_DISCORD_INVITE_URL);
}
