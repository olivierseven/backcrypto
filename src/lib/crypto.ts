import crypto from "crypto";

let _encKey: Buffer | null = null;

function getEncKey(): Buffer {
  if (_encKey) return _encKey;
  const b64 = process.env.EMAIL_ENC_KEY_B64;
  if (!b64 || typeof b64 !== "string") throw new Error("EMAIL_ENC_KEY_B64 is required for encryption/decryption.");
  _encKey = Buffer.from(b64, "base64");
  if (_encKey.length !== 32) throw new Error("EMAIL_ENC_KEY_B64 deve ter 32 bytes (base64).");
  return _encKey;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function encryptEmail(email: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncKey(), iv);
  const plaintext = Buffer.from(email, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { enc: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

export function emailSearchHash(email: string) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function decryptEmail(enc: string, ivB64: string, tagB64: string) {
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncKey(), iv);
  decipher.setAuthTag(tag);
  const ciphertext = Buffer.from(enc, "base64");
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
