/**
 * Controle de uma aba ativa por usuário via banco.
 * Evita múltiplas abas/navegadores sobrecarregando o sistema.
 */
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

/** Aba que acabou de ser substituída fica bloqueada por este tempo (segundos). */
const PREVIOUS_TAB_BLOCK_SEC = 65;

/**
 * Tenta reivindicar a sessão ativa para este tabId.
 * Nova aba/janela assume direto (substitui a anterior); as outras caem em até 1 min (heartbeat 409).
 * forceTakeOver: quando true (ex.: botão "Usar esta aba" numa aba já bloqueada), assume a sessão.
 */
export async function claimOrRejectSession(
  _request: Request,
  userId: string,
  tabId: string | null,
  forceTakeOver = false
): Promise<NextResponse | null> {
  if (!tabId || typeof tabId !== "string" || tabId.length > 128) {
    return null;
  }

  const canClaim = await cryptoPrisma.$transaction(async (tx) => {
    type Row = {
      active_tab_id: string | null;
      active_tab_updated_at: Date | null;
      previous_tab_id: string | null;
      previous_tab_updated_at: Date | null;
    };
    const rows = await tx.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT active_tab_id, active_tab_updated_at, previous_tab_id, previous_tab_updated_at
        FROM backcrypto."User"
        WHERE id = ${userId}
        FOR UPDATE
      `
    );
    const row = rows[0];
    if (!row) return false;

    const currentTabId = row.active_tab_id;
    const updatedAt = row.active_tab_updated_at;
    const previousTabId = row.previous_tab_id;
    const previousTabUpdatedAt = row.previous_tab_updated_at;

    if (forceTakeOver) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE backcrypto."User"
          SET active_tab_id = ${tabId}, active_tab_updated_at = now(),
              previous_tab_id = ${currentTabId}, previous_tab_updated_at = now()
          WHERE id = ${userId}
        `
      );
      return true;
    }

    if (currentTabId === tabId) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE backcrypto."User"
          SET active_tab_updated_at = now()
          WHERE id = ${userId}
        `
      );
      return true;
    }

    const now = new Date();
    const previousBlockUntil = previousTabUpdatedAt
      ? new Date(previousTabUpdatedAt.getTime() + PREVIOUS_TAB_BLOCK_SEC * 1000)
      : null;
    if (previousTabId === tabId && previousBlockUntil && now < previousBlockUntil) {
      return false;
    }

    // Nova aba assume direto: substitui a atual; a antiga receberá 409 no próximo heartbeat.
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE backcrypto."User"
        SET active_tab_id = ${tabId}, active_tab_updated_at = now(),
            previous_tab_id = ${currentTabId}, previous_tab_updated_at = now()
        WHERE id = ${userId}
      `
    );
    return true;
  });

  if (!canClaim) {
    return NextResponse.json(
      { code: "ANOTHER_SESSION_ACTIVE" },
      { status: 409 }
    );
  }
  return null;
}

/**
 * Lê o header X-Tab-Id da request.
 */
export function getTabIdFromRequest(request: Request): string | null {
  return request.headers.get("x-tab-id")?.trim() || null;
}

/**
 * Lê se o cliente pediu para forçar uso desta aba (botão "Usar esta aba").
 */
export function getForceClaimFromRequest(request: Request): boolean {
  const h = request.headers.get("x-force-claim")?.toLowerCase();
  if (h === "1" || h === "true" || h === "yes") return true;
  const url = new URL(request.url);
  return url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
}
