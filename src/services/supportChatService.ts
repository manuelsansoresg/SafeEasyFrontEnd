import { fetchWithAuth } from "@/lib/api";
import type { SupportConversation, SupportMessage } from "@/types/support-chat";

const SUPPORT_BASE = "/api/chat/support";
const SUPPORT_READ_STORAGE_KEY = "drooopy:support_read_v1";
type SupportFetchOptions = RequestInit & { headers?: Record<string, string> };

const readLocalReadMap = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SUPPORT_READ_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalReadMap = (map: Record<string, number>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPORT_READ_STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
};

export const markSupportConversationReadLocally = (conversation: SupportConversation | string) => {
  const id = typeof conversation === "string" ? conversation : conversation.id;
  if (!id) return;
  const readMap = readLocalReadMap();
  readMap[id] = Date.now();
  writeLocalReadMap(readMap);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("support-chat-read", { detail: { conversationId: id } }));
  }
};

const parseError = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    const message = data?.detail || data?.message || data?.msg;
    if (res.status >= 500 && (!message || String(message).toLowerCase() === "internal server error")) {
      return `${fallback} El servidor respondió Internal Server Error.`;
    }
    return message || fallback;
  } catch {
    if (res.status >= 500) {
      return `${fallback} El servidor respondió Internal Server Error.`;
    }
    return fallback;
  }
};

const requestJson = async <T>(url: string, options: SupportFetchOptions = {}, fallback: string): Promise<T> => {
  const res = await fetchWithAuth(url, options);
  if (!res.ok) {
    throw new Error(await parseError(res, fallback));
  }
  return res.json() as Promise<T>;
};

export const supportChatService = {
  getConversations(skip = 0, limit = 50) {
    return requestJson<SupportConversation[]>(
      `${SUPPORT_BASE}?skip=${skip}&limit=${limit}`,
      { headers: { Accept: "application/json" } },
      "No se pudieron cargar las conversaciones de soporte."
    );
  },

  getUnassigned(skip = 0, limit = 50) {
    return requestJson<SupportConversation[]>(
      `${SUPPORT_BASE}/admin/unassigned?skip=${skip}&limit=${limit}`,
      { headers: { Accept: "application/json" } },
      "No se pudieron cargar las conversaciones sin asignar."
    );
  },

  createConversation(subject: string) {
    return requestJson<SupportConversation>(
      SUPPORT_BASE,
      {
        method: "POST",
        body: JSON.stringify({ subject }),
      },
      "No se pudo crear la conversación de soporte."
    );
  },

  getMessages(conversationId: string, skip = 0, limit = 50) {
    return requestJson<SupportMessage[]>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/messages?skip=${skip}&limit=${limit}`,
      { headers: { Accept: "application/json" } },
      "No se pudieron cargar los mensajes."
    );
  },

  sendMessage(conversationId: string, message: string) {
    return requestJson<SupportMessage>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
      "No se pudo enviar el mensaje."
    );
  },

  resolve(conversationId: string) {
    return requestJson<{ msg: string }>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/resolve`,
      { method: "POST" },
      "No se pudo marcar como resuelta."
    );
  },

  close(conversationId: string) {
    return requestJson<{ msg: string }>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/close`,
      { method: "POST" },
      "No se pudo cerrar la conversación."
    );
  },

  markAsRead(conversationId: string) {
    markSupportConversationReadLocally(conversationId);
    return requestJson<{ msg: string }>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/mark-read`,
      { method: "POST" },
      "No se pudo marcar la conversación como leída."
    );
  },

  claim(conversationId: string) {
    return requestJson<{ msg: string; admin_id: number; admin_name: string | null }>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/claim`,
      { method: "POST" },
      "No se pudo tomar la conversación."
    );
  },

  reject(conversationId: string) {
    return requestJson<{ msg: string }>(
      `${SUPPORT_BASE}/${encodeURIComponent(conversationId)}/reject`,
      { method: "POST" },
      "No se pudo liberar la conversación."
    );
  },
};
