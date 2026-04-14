// API descontinuada: tabelas Bio removidas do backcrypto.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "gone", message: "Recurso descontinuado (tabelas Bio removidas).", jobs: [] },
    { status: 410 }
  );
}
