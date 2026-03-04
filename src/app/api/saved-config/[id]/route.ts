// GET /api/biogenerator/saved-config/[id] — carrega configuração por uid (descompacta se _compressed)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { gunzipSync } from "node:zlib";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const row = await bioPrisma.bioSavedConfig.findUnique({
    where: { id },
    select: { id: true, name: true, config: true, mapDisplayByYear: true, userId: true, private: true },
  });

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (row.private && row.userId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let config = row.config;
  const raw = config as { _compressed?: boolean; data?: string } | null;
  if (raw && typeof raw === "object" && raw._compressed === true && typeof raw.data === "string") {
    try {
      const decompressed = gunzipSync(Buffer.from(raw.data, "base64"));
      config = JSON.parse(decompressed.toString("utf-8")) as object;
    } catch {
      // fallback: devolve como veio (não quebra configs corrompidos)
    }
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    config,
    mapDisplayByYear: row.mapDisplayByYear ?? undefined,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const row = await bioPrisma.bioSavedConfig.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.userId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await bioPrisma.bioSavedConfig.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
