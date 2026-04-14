import { NextResponse } from "next/server";
import { getAffiliateSessionFromCookie } from "@/lib/affiliate-jwt-server";
import { isAffiliateBillingSectionUnlocked } from "@/lib/affiliate-billing-section-unlocked";
import { normalizeCnpjDigits, isValidCnpjDigits } from "@/lib/cnpj";
import { cryptoPrisma } from "@/lib/crypto-db";
import { normalizeEmail } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = {
  razao: 512,
  email: 320,
  bank: 256,
  agencia: 32,
  conta: 64,
  pix: 512,
  country: 120,
  swift: 32,
  iban: 64,
} as const;

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isLooseEmail(s: string): boolean {
  if (s.length > MAX.email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** GET: perfil guardado (afiliado autenticado). */
export async function GET() {
  const session = await getAffiliateSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email: normalizeEmail(session.email) },
    select: {
      id: true,
      idAfiliado: true,
      payoutProfile: true,
    },
  });

  if (!app) {
    return NextResponse.json({ ok: false, error: "no_application" }, { status: 404 });
  }

  const unlocked = await isAffiliateBillingSectionUnlocked(app.idAfiliado);
  if (!unlocked) {
    return NextResponse.json({ ok: false, error: "payout_section_locked" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, profile: app.payoutProfile });
}

type Body = {
  activeTab?: string;
  br?: {
    razaoSocial?: string;
    cnpjDigits?: string;
    banco?: string;
    tipoConta?: string;
    agencia?: string;
    numeroConta?: string;
    chavePix?: string;
  };
  intl?: {
    paymentMethod?: string;
    paypalEmail?: string;
    bankName?: string;
    /** Preferência: um dos dois; legado: `accountOrIban`. */
    iban?: string;
    accountNumber?: string;
    accountOrIban?: string;
    swiftBic?: string;
    accountHolderName?: string;
    country?: string;
  };
};

/** PUT: grava ou atualiza dados de recebimento (valida conforme `activeTab`). */
export async function PUT(req: Request) {
  const session = await getAffiliateSessionFromCookie();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const app = await cryptoPrisma.affiliateApplication.findUnique({
    where: { email: normalizeEmail(session.email) },
    select: { id: true, idAfiliado: true },
  });

  if (!app) {
    return NextResponse.json({ ok: false, error: "no_application" }, { status: 404 });
  }

  const unlocked = await isAffiliateBillingSectionUnlocked(app.idAfiliado);
  if (!unlocked) {
    return NextResponse.json({ ok: false, error: "payout_section_locked" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const activeTab = trimStr(body.activeTab);
  if (activeTab !== "br" && activeTab !== "intl") {
    return NextResponse.json({ ok: false, error: "invalid_active_tab" }, { status: 400 });
  }

  const br = body.br ?? {};
  const intl = body.intl ?? {};

  const brRazaoSocial = trimStr(br.razaoSocial).slice(0, MAX.razao);
  const brCnpjDigits = normalizeCnpjDigits(trimStr(br.cnpjDigits));
  const brBanco = trimStr(br.banco).slice(0, MAX.bank);
  const brTipoConta = trimStr(br.tipoConta).toLowerCase();
  const brAgencia = trimStr(br.agencia).slice(0, MAX.agencia);
  const brNumeroConta = trimStr(br.numeroConta).slice(0, MAX.conta);
  const brChavePix = trimStr(br.chavePix).slice(0, MAX.pix);

  const intPaymentMethod = trimStr(intl.paymentMethod).toLowerCase();
  const intPaypalEmail = trimStr(intl.paypalEmail).slice(0, MAX.email);
  const intBankName = trimStr(intl.bankName).slice(0, MAX.bank);
  const intIbanIn = trimStr(intl.iban).slice(0, MAX.iban);
  const intAccNumIn = trimStr(intl.accountNumber).slice(0, MAX.iban);
  const intAccountOrIbanLegacy = trimStr(intl.accountOrIban).slice(0, MAX.iban);
  let intAccountOrIban = "";
  if (intIbanIn && intAccNumIn) {
    return NextResponse.json({ ok: false, error: "intl_wire_iban_both" }, { status: 400 });
  }
  intAccountOrIban = intIbanIn || intAccNumIn || intAccountOrIbanLegacy;
  const intSwiftBic = trimStr(intl.swiftBic).slice(0, MAX.swift);
  const intAccountHolderName = trimStr(intl.accountHolderName).slice(0, MAX.razao);
  const intCountry = trimStr(intl.country).slice(0, MAX.country);

  if (activeTab === "br") {
    if (!brRazaoSocial) {
      return NextResponse.json({ ok: false, error: "br_required_fields" }, { status: 400 });
    }
    if (brCnpjDigits.length !== 14 || !isValidCnpjDigits(brCnpjDigits)) {
      return NextResponse.json({ ok: false, error: "br_invalid_cnpj" }, { status: 400 });
    }

    const hasPix = brChavePix.length > 0;
    const anyBank = !!(brBanco || brAgencia || brNumeroConta || brTipoConta);
    const tipoOk = brTipoConta === "corrente" || brTipoConta === "poupanca";
    const fullBank = !!(brBanco && brAgencia && brNumeroConta && tipoOk);

    if (anyBank && !fullBank) {
      return NextResponse.json({ ok: false, error: "br_bank_incomplete" }, { status: 400 });
    }
    /** Chave PIX **ou** dados bancários completos. */
    if (!hasPix && !fullBank) {
      return NextResponse.json({ ok: false, error: "br_payment_required" }, { status: 400 });
    }
  } else {
    if (intPaymentMethod !== "paypal" && intPaymentMethod !== "wire") {
      return NextResponse.json({ ok: false, error: "intl_invalid_method" }, { status: 400 });
    }
    if (intPaymentMethod === "paypal") {
      if (!intPaypalEmail || !isLooseEmail(intPaypalEmail)) {
        return NextResponse.json({ ok: false, error: "intl_paypal_email" }, { status: 400 });
      }
    } else {
      if (!intBankName || !intSwiftBic || !intAccountHolderName || !intCountry || !intAccountOrIban) {
        return NextResponse.json({ ok: false, error: "intl_wire_required" }, { status: 400 });
      }
    }
  }

  const data = {
    activeTab,
    brRazaoSocial: brRazaoSocial || null,
    brCnpjDigits: brCnpjDigits || null,
    brBanco: brBanco || null,
    brTipoConta: brTipoConta === "corrente" || brTipoConta === "poupanca" ? brTipoConta : null,
    brAgencia: brAgencia || null,
    brNumeroConta: brNumeroConta || null,
    brChavePix: brChavePix || null,
    intPaymentMethod: intPaymentMethod === "paypal" || intPaymentMethod === "wire" ? intPaymentMethod : null,
    intPaypalEmail: intPaypalEmail || null,
    intBankName: intBankName || null,
    intAccountOrIban: intAccountOrIban || null,
    intSwiftBic: intSwiftBic || null,
    intAccountHolderName: intAccountHolderName || null,
    intCountry: intCountry || null,
  };

  const row = await cryptoPrisma.affiliatePayoutProfile.upsert({
    where: { affiliateApplicationId: app.id },
    create: {
      affiliateApplicationId: app.id,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({ ok: true, profile: row });
}
