// src/lib/push-notification.ts
// Envia push notification via FCM (Firebase Cloud Messaging)
// Usa as mesmas variáveis do SevenCoins: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON

import * as admin from "firebase-admin";
import { bioPrisma } from "./bio-db";

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

let firebaseAdminInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return;
  }
  if (admin.apps.length > 0) {
    firebaseAdminInitialized = true;
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

  if (!serviceAccountJson || !firebaseProjectId) {
    console.warn(
      "[Push] Firebase não configurado - FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_PROJECT_ID não encontrado"
    );
    return;
  }

  try {
    const cleanedJson = serviceAccountJson.trim().replace(/\s+/g, " ");
    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(cleanedJson);
    } catch (e) {
      console.error(
        "[Push] Erro ao fazer parse do FIREBASE_SERVICE_ACCOUNT_JSON:",
        e
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseProjectId,
    });

    firebaseAdminInitialized = true;
    console.log("[Push] Firebase Admin SDK inicializado com sucesso");
  } catch (error) {
    console.error("[Push] Erro ao inicializar Firebase Admin SDK:", error);
  }
}

/**
 * Envia push notification para um usuário via FCM
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    initializeFirebaseAdmin();

    if (!firebaseAdminInitialized || admin.apps.length === 0) {
      return { success: false, error: "Firebase não configurado" };
    }

    const user = await bioPrisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) {
      return { success: false, error: "Token de push não encontrado" };
    }

    const message: admin.messaging.Message = {
      token: user.pushToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data
        ? Object.fromEntries(
            Object.entries(payload.data).map(([k, v]) => [k, String(v)])
          )
        : undefined,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default" },
        },
      },
    };

    await admin.messaging().send(message);
    return { success: true };
  } catch (error) {
    console.error("[Push] Erro ao enviar push notification:", error);

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("registration-token-not-registered") ||
        msg.includes("invalid-registration-token")
      ) {
        await bioPrisma.user
          .update({
            where: { id: userId },
            data: { pushToken: null, pushTokenUpdated: new Date() },
          })
          .catch(() => {});
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Envia push para múltiplos usuários
 */
export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    result.success ? success++ : failed++;
  }
  return { success, failed };
}
