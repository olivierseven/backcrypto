import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { warn } from "@/lib/logger";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface SavesReportRow {
  id: string;
  idShort: string;
  name: string;
  configBytes: number;
  configKb: number;
  createdAt: string;
}

export interface SavesReportResponse {
  userId: string;
  rows: SavesReportRow[];
  totalBytes: number;
  totalKb: number;
  averageBytes: number;
  averageKb: number;
  count: number;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;
    if (!token) {
      warn("[bio/admin/saves-report] unauthorized: no token");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!adminId) {
      warn("[bio/admin/saves-report] unauthorized: invalid payload");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminUser = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!adminUser || adminUser.role !== "admin") {
      warn(`[bio/admin/saves-report] forbidden: userId=${adminId.slice(0, 8)}...`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "Informe userId" }, { status: 400 });
    }

    const rows = await cryptoPrisma.bioSavedConfig.findMany({
      where: { userId },
      select: { id: true, name: true, config: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const reportRows: SavesReportRow[] = [];
    let totalBytes = 0;

    for (const row of rows) {
      const configStr = JSON.stringify(row.config);
      const configBytes = Buffer.byteLength(configStr, "utf8");
      totalBytes += configBytes;
      reportRows.push({
        id: row.id,
        idShort: row.id.length > 14 ? row.id.slice(0, 14) + "…" : row.id,
        name: row.name ?? "",
        configBytes,
        configKb: Math.round((configBytes / 1024) * 100) / 100,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "",
      });
    }

    const count = reportRows.length;
    const averageBytes = count > 0 ? Math.round(totalBytes / count) : 0;
    const averageKb = count > 0 ? Math.round((totalBytes / count / 1024) * 100) / 100 : 0;

    const response: SavesReportResponse = {
      userId,
      rows: reportRows,
      totalBytes,
      totalKb: Math.round((totalBytes / 1024) * 100) / 100,
      averageBytes,
      averageKb,
      count,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
