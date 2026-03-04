import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { bioPrisma } from "@/lib/bio-db";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { payload } = await jwtVerify(token, JWT_SECRET).catch(() => ({ payload: null as any }));
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  const user = await bioPrisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true },
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  if (user.isDeleted) return NextResponse.json({ error: "already_deleted" }, { status: 400 });

  const dataExpiracao = new Date();
  dataExpiracao.setDate(dataExpiracao.getDate() + 30);

  await bioPrisma.user.update({
    where: { id: userId },
    data: { isDeleted: true, dataExclusao: null, dataExpiracao },
  });

  return NextResponse.json({
    success: true,
    message: "Conta desativada com sucesso. Você terá 30 dias para reativar sua conta.",
    dataExpiracao: dataExpiracao.toISOString(),
  });
}
