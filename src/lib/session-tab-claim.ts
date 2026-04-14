/**
 * Controle de abas ativas por utilizador via banco (lista JSON, máximo configurável).
 * Evita demasiadas abas/navegadores a sobrecarregar o sistema.
 */
import { NextResponse } from "next/server";
import { cryptoPrisma } from "@/lib/crypto-db";
import { Prisma } from "@/lib/prisma-bio-client";

/** Aba expulsa por LRU fica em cooldown (segundos) antes de poder voltar sem forçar. */
const PREVIOUS_TAB_BLOCK_SEC = 65;

type SlotRow = { id: string; at: string };
type EvictedRow = { id: string; until: string };

function getMaxSessionTabs(): number {
  const raw = process.env.SISTEMA_MAX_SESSION_TABS?.trim();
  const n = raw ? parseInt(raw, 10) : 2;
  if (!Number.isFinite(n)) return 2;
  return Math.min(20, Math.max(1, n));
}

function parseJsonArray<T>(raw: unknown, validate: (x: unknown) => x is T): T[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    if (validate(item)) out.push(item);
  }
  return out;
}

function isSlotRow(x: unknown): x is SlotRow {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    typeof (x as SlotRow).id === "string" &&
    (x as SlotRow).id.length > 0 &&
    (x as SlotRow).id.length <= 128 &&
    "at" in x &&
    typeof (x as SlotRow).at === "string"
  );
}

function isEvictedRow(x: unknown): x is EvictedRow {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    typeof (x as EvictedRow).id === "string" &&
    (x as EvictedRow).id.length > 0 &&
    (x as EvictedRow).id.length <= 128 &&
    "until" in x &&
    typeof (x as EvictedRow).until === "string"
  );
}

function dedupeSlots(slots: SlotRow[]): SlotRow[] {
  const byId = new Map<string, SlotRow>();
  for (const s of slots) {
    const prev = byId.get(s.id);
    if (!prev || new Date(s.at).getTime() > new Date(prev.at).getTime()) {
      byId.set(s.id, s);
    }
  }
  return Array.from(byId.values());
}

function pruneEvicted(evicted: EvictedRow[], now: Date): EvictedRow[] {
  const t = now.getTime();
  return evicted.filter((e) => new Date(e.until).getTime() > t);
}

function mergeEvictedDedupe(evicted: EvictedRow[]): EvictedRow[] {
  const byId = new Map<string, EvictedRow>();
  for (const e of evicted) {
    const prev = byId.get(e.id);
    if (!prev || new Date(e.until).getTime() > new Date(prev.until).getTime()) {
      byId.set(e.id, e);
    }
  }
  return Array.from(byId.values());
}

function isTabEvicted(evicted: EvictedRow[], tabId: string, now: Date): boolean {
  const t = now.getTime();
  return evicted.some((e) => e.id === tabId && new Date(e.until).getTime() > t);
}

function findLru(slots: SlotRow[]): number {
  if (slots.length === 0) return -1;
  let idx = 0;
  let min = new Date(slots[0].at).getTime();
  for (let i = 1; i < slots.length; i++) {
    const ts = new Date(slots[i].at).getTime();
    if (ts < min) {
      min = ts;
      idx = i;
    }
  }
  return idx;
}

/**
 * Tenta reivindicar um slot de sessão para este tabId.
 * Até N abas (default 2, SISTEMA_MAX_SESSION_TABS); acima disso expulsa a LRU (cooldown ~65s).
 * forceTakeOver: remove cooldown desta aba e garante entrada (expulsando LRU se necessário).
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

  const maxTabs = getMaxSessionTabs();

  const canClaim = await cryptoPrisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT id FROM backcrypto."User" WHERE id = ${userId} FOR UPDATE`);

    const row = await tx.user.findUnique({
      where: { id: userId },
      select: {
        sessionTabSlots: true,
        sessionEvictedTabs: true,
        activeTabId: true,
        activeTabUpdatedAt: true,
        previousTabId: true,
        previousTabUpdatedAt: true,
      },
    });
    if (!row) return false;

    const now = new Date();

    let slots = dedupeSlots(parseJsonArray(row.sessionTabSlots, isSlotRow));
    if (slots.length === 0 && row.activeTabId) {
      slots = [
        {
          id: row.activeTabId,
          at: (row.activeTabUpdatedAt ?? now).toISOString(),
        },
      ];
    }
    slots = dedupeSlots(slots).slice(0, maxTabs);

    let evicted = mergeEvictedDedupe(parseJsonArray(row.sessionEvictedTabs, isEvictedRow));
    if (
      evicted.length === 0 &&
      row.previousTabId &&
      row.previousTabUpdatedAt
    ) {
      const until = new Date(row.previousTabUpdatedAt.getTime() + PREVIOUS_TAB_BLOCK_SEC * 1000);
      if (until > now) {
        evicted.push({ id: row.previousTabId, until: until.toISOString() });
      }
    }
    evicted = pruneEvicted(mergeEvictedDedupe(evicted), now);

    const pushEvicted = (id: string) => {
      const until = new Date(now.getTime() + PREVIOUS_TAB_BLOCK_SEC * 1000);
      evicted = mergeEvictedDedupe([...evicted, { id, until: until.toISOString() }]);
      evicted = pruneEvicted(evicted, now);
    };

    const admitNewTab = () => {
      if (slots.length < maxTabs) {
        slots.push({ id: tabId, at: now.toISOString() });
        return;
      }
      const lru = findLru(slots);
      if (lru < 0) {
        slots = [{ id: tabId, at: now.toISOString() }];
        return;
      }
      const removed = slots[lru];
      slots.splice(lru, 1);
      pushEvicted(removed.id);
      slots.push({ id: tabId, at: now.toISOString() });
    };

    if (forceTakeOver) {
      evicted = evicted.filter((e) => e.id !== tabId);
      const idx = slots.findIndex((s) => s.id === tabId);
      if (idx >= 0) {
        slots[idx] = { id: tabId, at: now.toISOString() };
      } else {
        admitNewTab();
      }
    } else {
      if (isTabEvicted(evicted, tabId, now)) {
        return false;
      }
      const idx = slots.findIndex((s) => s.id === tabId);
      if (idx >= 0) {
        slots[idx] = { id: tabId, at: now.toISOString() };
      } else {
        admitNewTab();
      }
    }

    slots = dedupeSlots(slots).slice(0, maxTabs);

    await tx.user.update({
      where: { id: userId },
      data: {
        sessionTabSlots: slots as Prisma.InputJsonValue,
        sessionEvictedTabs: evicted as Prisma.InputJsonValue,
      },
    });

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
