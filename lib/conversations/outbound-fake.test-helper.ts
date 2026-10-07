import type {
  ClaimResult,
  OutboundRecord,
  OutboundRepository,
  SendContext,
} from "@/lib/conversations/send-text";

/** Repositorio en memoria para probar el envío sin base de datos ni Meta. */
export const CONVERSATION_ID = "3f2b8c1e-5a4d-4e6f-9a1b-0c2d3e4f5a6b";
export const REQUEST_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

export function makeContext(over: Partial<SendContext["canal"]> = {}): SendContext {
  return {
    conversationId: CONVERSATION_ID,
    canal: {
      id: "canal-1",
      provider: "whatsapp_cloud",
      externalAccountId: "1365004563368241",
      status: "connected",
      ...over,
    },
    contactPhone: "+34600111222",
  };
}

type StoredRow = OutboundRecord & { client_request_id: string };

export function createFakeOutboundRepo(options: {
  context?: SendContext | null;
  /** Nº de llamadas a markSent que fallarán antes de funcionar. */
  markSentFailures?: number;
} = {}) {
  const context = options.context === undefined ? makeContext() : options.context;
  const rows: StoredRow[] = [];
  const touches: { preview: string; at: Date }[] = [];
  let markSentFailures = options.markSentFailures ?? 0;
  let nextId = 1;

  const repo: OutboundRepository = {
    async loadContext(conversationId) {
      return context && conversationId === context.conversationId ? context : null;
    },
    async claim(input): Promise<ClaimResult> {
      const existing = rows.find((r) => r.client_request_id === input.requestId);
      if (existing) return { status: "existing", message: { ...existing } };
      const row: StoredRow = {
        id: `msg-${nextId++}`,
        conversacion_id: input.conversationId,
        external_id: null,
        direction: "outbound",
        sender_type: "human",
        content_type: input.content.contentType,
        text: input.content.text,
        media: input.content.contentType === "text" ? null : input.content.media,
        status: "pending",
        provider_timestamp: input.now.toISOString(),
        received_at: input.now.toISOString(),
        client_request_id: input.requestId,
      };
      rows.push(row);
      return { status: "claimed", message: { ...row } };
    },
    async reclaimFailed(messageId) {
      const row = rows.find((r) => r.id === messageId);
      if (!row || row.status !== "failed") return false;
      row.status = "pending";
      return true;
    },
    async markSent({ messageId, wamid, sentAt, media }) {
      if (markSentFailures > 0) {
        markSentFailures--;
        throw new Error("db down");
      }
      const row = rows.find((r) => r.id === messageId)!;
      row.status = "sent";
      row.external_id = wamid;
      if (media) row.media = media;
      row.provider_timestamp = sentAt.toISOString();
      return { ...row };
    },
    async markFailed(messageId) {
      rows.find((r) => r.id === messageId)!.status = "failed";
    },
    async touchConversation({ preview, at }) {
      touches.push({ preview, at });
      return true;
    },
  };

  return { repo, rows, touches };
}
