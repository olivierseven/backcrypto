import { redirect } from "next/navigation";
import { CRYPTO_DISCORD_INVITE_URL } from "@/app/lib/cryptoDiscordCommunityInvite";

/** /crypto/community → mesmo destino que /comunidade (Discord). */
export default function CommunityRedirectPage() {
  redirect(CRYPTO_DISCORD_INVITE_URL);
}
