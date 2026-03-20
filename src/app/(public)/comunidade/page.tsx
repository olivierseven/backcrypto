import { redirect } from "next/navigation";

const DISCORD_INVITE = "https://discord.gg/aEmES262Vh";

/** /crypto/comunidade → Discord (link estável para partilhar). */
export default function ComunidadeRedirectPage() {
  redirect(DISCORD_INVITE);
}
