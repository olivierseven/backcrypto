import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BACKCRYPTO_CHAT_PROMPT } from "@/lib/backcrypto-chat-personality";

export const runtime = "nodejs";
export const revalidate = 0;

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.BACKCRYPTO_CHAT_API_KEY;

    if (expectedKey && (!authHeader || !authHeader.startsWith("Bearer "))) {
      return NextResponse.json(
        { success: false, message: "Token de autorização necessário" },
        { status: 401 }
      );
    }

    if (expectedKey) {
      const token = authHeader!.substring(7);
      if (token !== expectedKey) {
        return NextResponse.json(
          { success: false, message: "Token de autorização inválido" },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { message, context, currentPage } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, message: "Mensagem é obrigatória" },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Mensagem muito longa. Máximo 1.000 caracteres." },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, message: "Serviço de chat não configurado." },
        { status: 500 }
      );
    }

    const geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.8,
        topP: 0.9,
        topK: 40,
      },
    });

    const currentPageInfo = currentPage ? `\n\nPÁGINA ATUAL: ${currentPage}` : "";
    const contextPrompt = context ? `\n\nCONTEXTO DA CONVERSA:\n${context}` : "";

    const fullPrompt = `${BACKCRYPTO_CHAT_PROMPT}
${contextPrompt}
${currentPageInfo}

Pergunta: ${message}

Resposta:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    if (!text || text.length === 0) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === "SAFETY") {
        return NextResponse.json({
          success: true,
          message: "Não consegui responder a essa pergunta. Que tal perguntar sobre o simulador ou como usar o Backtest Crypto? 📊",
          model: geminiModel,
          timestamp: new Date().toISOString(),
        });
      }
      return NextResponse.json({
        success: true,
        message: "Desculpe, tive um problema ao processar. Pode repetir ou reformular?",
        model: geminiModel,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: text,
      model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacktestCryptoChat] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
