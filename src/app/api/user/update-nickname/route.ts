import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { validateNickname } from "@/lib/validate-nickname";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: Request) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { payload } = await jwtVerify(token, JWT_SECRET).catch(() => ({ payload: null as any }));
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 401 });

  let body: { nickname?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const nickname = body.nickname;
  if (nickname === null || nickname === undefined) {
    return NextResponse.json({ error: "nickname_required", message: "Nickname é obrigatório" }, { status: 400 });
  }
  if (typeof nickname !== "string") {
    return NextResponse.json({ error: "nickname must be a string" }, { status: 400 });
  }

  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "nickname_empty", message: "Nickname não pode ser vazio" }, { status: 400 });
  }

  const validationError = validateNickname(trimmed);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const user = await cryptoPrisma.user.findUnique({
    where: { id: userId },
    select: { role: true, nickname: true, nicknameChanges: true },
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const nicknameChanged = user.nickname !== trimmed;
  if (user.role === "user" && nicknameChanged && user.nicknameChanges >= 2) {
    return NextResponse.json({
      error: "nickname_change_limit_reached",
      message: "Você já atingiu o limite máximo de 2 alterações de apelido.",
    }, { status: 403 });
  }

  if (nicknameChanged) {
    const existing = await cryptoPrisma.user.findFirst({
      where: { nickname: { equals: trimmed, mode: "insensitive" }, id: { not: userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "nickname_already_exists", message: "Este nickname já está em uso" }, { status: 400 });
    }
  }

  const updateData: { nickname: string; nicknameChanges?: number } = { nickname: trimmed };
  if (nicknameChanged && user.role === "user") {
    updateData.nicknameChanges = user.nicknameChanges + 1;
  }

  await cryptoPrisma.user.update({ where: { id: userId }, data: updateData });
  return NextResponse.json({ success: true, nickname: trimmed });
}
