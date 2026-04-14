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
      warn("[crypto/admin/saves-report] unauthorized: no token");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const adminId = typeof payload?.sub === "string" ? payload.sub : "";
    if (!adminId) {
      warn("[crypto/admin/saves-report] unauthorized: invalid payload");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const adminUser = await cryptoPrisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!adminUser || adminUser.role !== "admin") {
      warn(`[crypto/admin/saves-report] forbidden: userId=${adminId.slice(0, 8)}...`);
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "Informe userId" }, { status: 400 });
    }

    // Tabelas Bio removidas do backcrypto; relatório vazio.
    const reportRows: SavesReportRow[] = [];
    const count = 0;
    const totalBytes = 0;
    const averageBytes = 0;
    const averageKb = 0;

    const response: SavesReportResponse = {
      userId,
      rows: reportRows,
      totalBytes,
      totalKb: 0,
      averageBytes,
      averageKb,
      count,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
