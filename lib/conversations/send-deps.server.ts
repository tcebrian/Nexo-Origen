import "server-only";

import { outboundRepository } from "@/lib/conversations/outbound.server";
import type { SendDeps } from "@/lib/conversations/send-text";
import {
  isWhatsAppSenderConfigured,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  uploadMedia,
} from "@/lib/whatsapp/cloud-api.server";

const UPLOAD_TIMEOUT_MS = 20_000;
export const SEND_TIMEOUT_MS = 15_000;

/** Dependencias reales del envío (Meta + base de datos), las mismas que usa el resto de Conversations. */
export function productionSendDeps(): SendDeps {
  return {
    repository: outboundRepository,
    sendText: (input) => sendTextMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    uploadMedia: (input) => uploadMedia(input, { timeoutMs: UPLOAD_TIMEOUT_MS }),
    sendDocument: (input) => sendDocumentMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    sendImage: (input) => sendImageMessage(input, { timeoutMs: SEND_TIMEOUT_MS }),
    isConfigured: isWhatsAppSenderConfigured,
  };
}
