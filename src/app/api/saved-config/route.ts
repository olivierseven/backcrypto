// POST /api/biogenerator/saved-config — salva configuração (compactada com gzip no banco)
// GET /api/biogenerator/saved-config — lista configs do usuário + públicas
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gzipSync } from "node:zlib";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { validateConfigName } from "@/lib/validate-config-name";
import { containsBlockedWord } from "@/lib/blocked-words";
import { dbg, warn, error } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const CONFIG_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_SAVED_CONFIGS_PER_USER = 100;

async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; config?: unknown; mapDisplayByYear?: unknown; private?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mapDisplayData =
    body.mapDisplayByYear != null &&
    typeof body.mapDisplayByYear === "object" &&
    !Array.isArray(body.mapDisplayByYear)
      ? (body.mapDisplayByYear as object)
      : null;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name_required", message: "Nome é obrigatório" }, { status: 400 });
  }

  const validationError = validateConfigName(name);
  if (validationError) {
    return NextResponse.json({ error: "invalid_name", message: validationError }, { status: 400 });
  }
  if (containsBlockedWord(name)) {
    return NextResponse.json({ error: "blocked_word", message: "O nome contém uma palavra inadequada" }, { status: 400 });
  }

  const config = body.config;
  if (config == null || typeof config !== "object") {
    return NextResponse.json({ error: "config_required", message: "Configuração é obrigatória" }, { status: 400 });
  }

  const configStr = JSON.stringify(config);
  if (configStr.length > CONFIG_MAX_BYTES) {
    return NextResponse.json({ error: "config_too_large", message: "Configuração excede o tamanho máximo" }, { status: 400 });
  }

  // Guarda compactado no banco: gzip + base64 (configs antigos sem _compressed continuam válidos)
  const compressed = gzipSync(Buffer.from(configStr, "utf-8"));
  const dataBase64 = compressed.toString("base64");
  const toStore = { _compressed: true as const, data: dataBase64 };

  const isPrivate = body.private !== false;

  const exists = await cryptoPrisma.bioSavedConfig.findUnique({
    where: { name },
    select: { id: true, userId: true },
  });

  try {
    if (exists) {
      if (exists.userId !== userId) {
        return NextResponse.json(
          { error: "name_already_in_use", message: "Este nome já está em uso. Escolha outro." },
          { status: 409 }
        );
      }
      // update: não conta contra o limite
      await cryptoPrisma.bioSavedConfig.update({
        where: { id: exists.id },
        data: {
          config: toStore as object,
          private: isPrivate,
          updatedAt: new Date(),
          ...(mapDisplayData !== null && { mapDisplayByYear: mapDisplayData }),
        },
      });
      dbg(`[saved-config] updated id=${exists.id} userId=${userId.slice(0, 8)}... name=${name}`);
      return NextResponse.json({ id: exists.id, name, updated: true });
    }

    // create: verificar limite
    const count = await cryptoPrisma.bioSavedConfig.count({ where: { userId } });
    if (count >= MAX_SAVED_CONFIGS_PER_USER) {
      return NextResponse.json(
        { error: "max_configs_reached", message: "Limite de 100 configurações salvas atingido. Exclua algumas para continuar." },
        { status: 400 }
      );
    }

    const row = await cryptoPrisma.bioSavedConfig.create({
      data: {
        userId,
        name,
        private: isPrivate,
        config: toStore as object,
        ...(mapDisplayData !== null && { mapDisplayByYear: mapDisplayData }),
      },
      select: { id: true, name: true, createdAt: true },
    });
    dbg(`[saved-config] created id=${row.id} userId=${userId.slice(0, 8)}... name=${name}`);
    return NextResponse.json({ id: row.id, name: row.name, createdAt: row.createdAt.toISOString() });
  } catch (e) {
    error(`[saved-config] error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const publicOnly = searchParams.get("public") === "1";

  try {
    const where = publicOnly
      ? { private: false }
      : { OR: [{ userId }, { private: false }] };

    const list = await cryptoPrisma.bioSavedConfig.findMany({
      where,
      select: {
        id: true,
        name: true,
        private: true,
        likes: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { nickname: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    });

    const items = list.map((r) => ({
      id: r.id,
      name: r.name,
      private: r.private,
      likes: r.likes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isOwner: r.userId === userId,
      ownerNickname: r.user?.nickname ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    error(`[saved-config] list error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
