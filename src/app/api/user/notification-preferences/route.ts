import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { jwtVerify } from "jose";
import { cryptoPrisma } from "@/lib/crypto-db";
import { APP_CRYPTO_ROUTE_PREFIX } from "@/app/constants";
import { z } from "zod";

const COOKIE = process.env.JWT_COOKIE_NAME || "session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const schema = z.object({
  hideStatusBar: z.boolean().optional(),
  language: z.enum(["en", "pt"]).optional(),
  timezoneOffset: z.number().int().min(-12).max(12).optional(),
});

export async function GET() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const user = await cryptoPrisma.user.findUnique({
      where: { id: userId },
      select: { hideStatusBar: true, language: true, timezoneOffset: true },
    });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    return NextResponse.json({ hideStatusBar: user.hideStatusBar, language: user.language, timezoneOffset: user.timezoneOffset ?? 0 });
  } catch (error) {
    console.error("[backcrypto/notification-preferences GET]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.errors }, { status: 400 });
    }

    const updateData: { hideStatusBar?: boolean; language?: "en" | "pt"; timezoneOffset?: number } = {};
    if (parsed.data.hideStatusBar !== undefined) updateData.hideStatusBar = parsed.data.hideStatusBar;
    if (parsed.data.language !== undefined) updateData.language = parsed.data.language;
    if (parsed.data.timezoneOffset !== undefined) updateData.timezoneOffset = parsed.data.timezoneOffset;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: "Nada a atualizar" });
    }

    await cryptoPrisma.user.update({ where: { id: userId }, data: updateData });
    /* Evita RSC/router.refresh com hideStatusBar (e resto) desatualizado — o toggle na Conta voltava ao estado inicial. */
    revalidatePath(`${APP_CRYPTO_ROUTE_PREFIX}/conta`, "layout");
    return NextResponse.json({ success: true, message: "Preferências atualizadas com sucesso" });
  } catch (error) {
    console.error("[backcrypto/notification-preferences]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
