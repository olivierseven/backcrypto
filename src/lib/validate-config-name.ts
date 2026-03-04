/** Validação do nome de configuração salva (similar ao nickname, max 64 chars). */
export function validateConfigName(v: string): string | null {
  if (!v || v.trim().length === 0) return "O nome não pode ser vazio";
  const trimmed = v.trim();
  if (!/^[A-Za-z0-9.\s_-]*$/.test(trimmed)) return "Permitido: letras, números, espaços, . _ -";
  const dot = (trimmed.match(/\./g) || []).length;
  const und = (trimmed.match(/_/g) || []).length;
  const hyf = (trimmed.match(/-/g) || []).length;
  if (dot > 1) return "Máximo 1 ponto (.)";
  if (und > 1) return "Máximo 1 underline (_)";
  if (hyf > 1) return "Máximo 1 hífen (-)";
  const kinds = Number(dot > 0) + Number(und > 0) + Number(hyf > 0);
  if (kinds > 1) return "Use apenas um tipo de símbolo (. ou _ ou -)";
  if (/^[.\s_-]/.test(trimmed)) return "Não pode começar com . _ - ou espaço";
  if (/[.\s_-]$/.test(trimmed)) return "Não pode terminar com . _ - ou espaço";
  if (trimmed.length < 3) return "Mínimo de 3 caracteres";
  if (trimmed.length > 64) return "Máximo de 64 caracteres";
  return null;
}
