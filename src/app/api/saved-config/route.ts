// API descontinuada: tabelas Bio removidas do backcrypto.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GONE_MESSAGE = { error: "gone", message: "Recurso descontinuado (tabelas Bio removidas)." };

export async function POST() {
  return NextResponse.json(GONE_MESSAGE, { status: 410 });
}

export async function GET() {
  return NextResponse.json(GONE_MESSAGE, { status: 410 });
}
