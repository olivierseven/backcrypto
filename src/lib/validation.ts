import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo de 3 caracteres")
  .max(30, "Máximo de 30 caracteres")
  .regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, underline e hífen")
  .refine((v) => (v.match(/\./g) || []).length <= 1, { message: "Máximo 1 ponto (.)" })
  .refine((v) => (v.match(/_/g) || []).length <= 1, { message: "Máximo 1 underline (_)" })
  .refine((v) => (v.match(/-/g) || []).length <= 1, { message: "Máximo 1 hífen (-)" })
  .refine((v) => {
    const dot = (v.match(/\./g) || []).length > 0;
    const und = (v.match(/_/g) || []).length > 0;
    const hyf = (v.match(/-/g) || []).length > 0;
    const kinds = Number(dot) + Number(und) + Number(hyf);
    return kinds <= 1;
  }, { message: "Use apenas um tipo de símbolo (. ou _ ou -)" })
  .refine((v) => !/^[._-]/.test(v), { message: "Não pode começar com . _ -" })
  .refine((v) => !/[._-]$/.test(v), { message: "Não pode terminar com . _ -" });

export const passwordSchema = z
  .string()
  .min(6, "A senha deve ter pelo menos 6 caracteres");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "E-mail muito curto")
  .max(254, "E-mail muito longo")
  .email("Informe um e-mail válido");
