// Recurso descontinuado (Bio/projeto antigo — não usado em crypto).
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GONE = { error: "gone", message: "Recurso descontinuado (tabelas Bio removidas)." };

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}
