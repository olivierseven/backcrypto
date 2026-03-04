-- Copia dados de public."User" para gotai."User" (evita duplicatas com ON CONFLICT)
INSERT INTO gotai."User" (
  "id", "emailEnc", "emailIv", "emailTag", "emailSearchHash", "emailVerifiedAt",
  "name", "passwordHash", "specialCodeHash", "specialExpiresAt", "createdAt", "updatedAt",
  "role", "tier", "nickname", "nicknameChanges", "avatarId", "avatarBorder",
  "avatarSkinTone", "avatarColorTone", "sevenPoints", "ganhoSimulado", "userLevel",
  "position", "tmp", "isDeleted", "dataExclusao", "dataExpiracao", "pushToken",
  "pushTokenUpdated", "notifyMegaSena", "notifyLotofacil", "notifyQuina", "hideStatusBar",
  "progress", "language"
)
SELECT
  "id", "emailEnc", "emailIv", "emailTag", "emailSearchHash", "emailVerifiedAt",
  "name", "passwordHash", "specialCodeHash", "specialExpiresAt", "createdAt", "updatedAt",
  "role"::text::gotai."Role",
  "tier"::text::gotai."Tier",
  "nickname", "nicknameChanges", "avatarId", "avatarBorder",
  "avatarSkinTone", "avatarColorTone", "sevenPoints", "ganhoSimulado",
  "userLevel"::text::gotai."UserLevel",
  "position", "tmp", "isDeleted", "dataExclusao", "dataExpiracao", "pushToken",
  "pushTokenUpdated", "notifyMegaSena", "notifyLotofacil", "notifyQuina", "hideStatusBar",
  "progress",
  'en'::gotai."BioLanguage" AS "language"
FROM public."User"
ON CONFLICT ("id") DO NOTHING;
