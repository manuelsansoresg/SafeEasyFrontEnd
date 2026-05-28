"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Clock,
  Inbox,
  Loader2,
  Lock,
  MessageSquareText,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { markSupportConversationReadLocally, supportChatService } from "@/services/supportChatService";
import { useSupportWebSocket } from "@/hooks/useSupportWebSocket";
import type { SupportConversation, SupportConversationStatus, SupportMessage, SupportSocketEvent } from "@/types/support-chat";

type SupportMode = "user" | "admin" | "unassigned";

interface SupportChatShellProps {
  mode: SupportMode;
}

const statusLabel: Record<SupportConversationStatus, string> = {
  open: "Abierta",
  resolved: "Solucionada",
  closed: "Cerrada sin solución",
};

const statusClass: Record<SupportConversationStatus, string> = {
  open: "bg-[#168e00]/10 text-[#0f6f00] border-[#168e00]/20",
  resolved: "bg-blue-50 text-blue-700 border-blue-100",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const adminRoles = new Set(["admin", "superuser"]);

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(date);
    if (diffDays === 1) return "Ayer";
    return new Intl.DateTimeFormat("es-MX", { month: "short", day: "numeric" }).format(date);
  } catch {
    return "";
  }
};

export function SupportChatShell({ mode }: SupportChatShellProps) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const routeConversationId = params?.id ? String(params.id) : null;
  const { user, token, isAuthenticated } = useAuthStore();

  const [hasMounted, setHasMounted] = useState(false);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [subject, setSubject] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const markReadAtRef = useRef<Record<string, number>>({});

  const isAdmin = adminRoles.has(String(user?.role || "").toLowerCase());
  const expectedAdmin = mode === "admin" || mode === "unassigned";

  const basePath = expectedAdmin ? "/admin/support" : "/support";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const sortedConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...conversations]
      .filter((conversation) => {
        if (!term) return true;
        return [conversation.subject, conversation.user_name, conversation.admin_name, conversation.last_message]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const dateA = new Date(a.last_message_time || a.created_at || 0).getTime();
        const dateB = new Date(b.last_message_time || b.created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [conversations, search]);

  const scrollToBottom = () => {
    window.setTimeout(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }, 80);
  };

  const markActiveConversationAsRead = useCallback((conversationId: string) => {
    markSupportConversationReadLocally(conversationId);
    const now = Date.now();
    const lastMarkedAt = markReadAtRef.current[conversationId] || 0;
    if (now - lastMarkedAt < 10000) return;
    markReadAtRef.current[conversationId] = now;
    supportChatService.markAsRead(conversationId).catch(() => {});
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const list = mode === "unassigned" ? await supportChatService.getUnassigned() : await supportChatService.getConversations();
    setConversations(list);
    if (routeConversationId) {
      const selected = list.find((conversation) => conversation.id === routeConversationId);
      if (selected) setActiveConversation(selected);
    }
  }, [mode, routeConversationId, user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const history = await supportChatService.getMessages(conversationId);
      setMessages(history);
      markSupportConversationReadLocally(conversationId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation
        )
      );
      setActiveConversation((prev) =>
        prev && prev.id === conversationId ? { ...prev, unread_count: 0 } : prev
      );
      scrollToBottom();
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    if (!isAuthenticated && !user && !token) {
      router.replace("/login");
      return;
    }

    if (!user) return;
    if (expectedAdmin && !isAdmin) {
      router.replace("/support");
      return;
    }
    if (!expectedAdmin && isAdmin) {
      router.replace("/admin/support");
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar soporte.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [expectedAdmin, hasMounted, isAdmin, isAuthenticated, refreshConversations, router, token, user]);

  const activeConversationId = activeConversation?.id || null;

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    loadMessages(activeConversationId).catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los mensajes.");
    });
    markActiveConversationAsRead(activeConversationId);
  }, [activeConversationId, loadMessages, markActiveConversationAsRead]);

  const handleSocketEvent = useCallback(
    (event: SupportSocketEvent) => {
      if (event.type === "pong") return;
      const conversationId = "conversation_id" in event ? event.conversation_id : null;
      if (!conversationId) return;

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          if (event.type === "support_conversation_updated") {
            const isActive = activeConversation?.id === conversation.id;
            return {
              ...conversation,
              last_message: event.last_message,
              last_message_time: event.updated_at,
              unread_count: isActive ? 0 : event.unread_count,
            };
          }
          if (event.type === "support_conversation_resolved") {
            return { ...conversation, status: "resolved", resolved_at: event.resolved_at };
          }
          if (event.type === "support_conversation_closed") {
            return { ...conversation, status: "closed", closed_at: event.closed_at };
          }
          if (event.type === "support_conversation_claimed") {
            return { ...conversation, admin_id: event.admin_id, admin_name: event.admin_name };
          }
          return conversation;
        })
      );

      if (activeConversation?.id === conversationId) {
        if (event.type === "support_conversation_resolved") {
          setActiveConversation((prev) => (prev ? { ...prev, status: "resolved", resolved_at: event.resolved_at } : prev));
        } else if (event.type === "support_conversation_closed") {
          setActiveConversation((prev) => (prev ? { ...prev, status: "closed", closed_at: event.closed_at } : prev));
        } else if (event.type === "support_conversation_claimed") {
          setActiveConversation((prev) =>
            prev ? { ...prev, admin_id: event.admin_id, admin_name: event.admin_name } : prev
          );
        } else if (event.type === "support_conversation_updated") {
          setActiveConversation((prev) =>
            prev
              ? {
                  ...prev,
                  last_message: event.last_message,
                  last_message_time: event.updated_at,
                  unread_count: 0,
                }
              : prev
          );
        } else if (event.type === "support_new_message") {
          markSupportConversationReadLocally(conversationId);
          loadMessages(conversationId).catch(() => {});
        }
      } else {
        refreshConversations().catch(() => {});
      }
    },
    [activeConversation?.id, loadMessages, refreshConversations]
  );

  const { isConnected } = useSupportWebSocket({
    conversationId: activeConversation?.id,
    token,
    onEvent: handleSocketEvent,
    enabled: !!activeConversation?.id && !!token,
  });

  const selectConversation = (conversation: SupportConversation) => {
    markSupportConversationReadLocally(conversation);
    markActiveConversationAsRead(conversation.id);
    const readConversation = { ...conversation, unread_count: 0 };
    setConversations((prev) => prev.map((item) => (item.id === conversation.id ? readConversation : item)));
    setActiveConversation(readConversation);
    if (routeConversationId !== conversation.id) router.push(`${basePath}/${conversation.id}`);
  };

  const createConversation = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = subject.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const conversation = await supportChatService.createConversation(trimmed);
      setSubject("");
      setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
      setActiveConversation(conversation);
      router.push(`/support/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el chat.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message || !activeConversation || activeConversation.status !== "open") return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await supportChatService.sendMessage(activeConversation.id, message);
      setInputValue("");
      setMessages((prev) => (prev.some((item) => item.id === created.id) ? prev : [...prev, created]));
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConversation.id
            ? { ...conversation, last_message: created.message, last_message_time: created.created_at }
            : conversation
        )
      );
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: "resolved" | "closed") => {
    if (!activeConversation) return;
    setSubmitting(true);
    setError(null);
    try {
      if (status === "resolved") await supportChatService.resolve(activeConversation.id);
      else await supportChatService.close(activeConversation.id);
      const now = new Date().toISOString();
      const next = {
        ...activeConversation,
        status,
        resolved_at: status === "resolved" ? now : activeConversation.resolved_at,
        closed_at: status === "closed" ? now : activeConversation.closed_at,
      };
      setActiveConversation(next);
      setConversations((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      setFinishModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la conversación.");
    } finally {
      setSubmitting(false);
    }
  };

  const claimConversation = async (conversation: SupportConversation) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await supportChatService.claim(conversation.id);
      const claimed = { ...conversation, admin_id: result.admin_id, admin_name: result.admin_name };
      setConversations((prev) => prev.filter((item) => item.id !== conversation.id));
      router.push(`/admin/support/${claimed.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo tomar la conversación.");
    } finally {
      setSubmitting(false);
    }
  };

  const rejectConversation = async () => {
    if (!activeConversation) return;
    setSubmitting(true);
    setError(null);
    try {
      await supportChatService.reject(activeConversation.id);
      router.push("/admin/support/unassigned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo liberar la conversación.");
    } finally {
      setSubmitting(false);
    }
  };

  const getConversationName = (conversation: SupportConversation) => {
    if (isAdmin) return conversation.user_name || `Usuario #${conversation.user_id}`;
    return conversation.admin_name || "Soporte Drooopy";
  };

  const canWrite = activeConversation?.status === "open" && mode !== "unassigned";

  return (
    <div className="space-y-4 font-[family-name:var(--font-poppins)] md:space-y-6">
      <div className={cn("rounded-lg bg-primary px-5 py-6 text-white shadow-sm md:px-8 md:py-7", activeConversation && "hidden md:block")}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-varela-round)] text-[#7ed957]">
              {isAdmin ? "Panel de soporte" : "Soporte"}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-varela-round)] text-3xl leading-tight md:text-4xl">
              {isAdmin ? "Conversaciones con usuarios" : "Chat con soporte Drooopy"}
            </h1>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/support" className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Asignadas
              </Link>
              <Link href="/admin/support/unassigned" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-[#f2f3f4]">
                Sin asignar
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}

      {!isAdmin && mode === "user" ? (
        <form onSubmit={createConversation} className={cn("rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5", activeConversation && "hidden md:block")}>
          <label className="text-sm font-semibold text-gray-900" htmlFor="support-subject">
            Nuevo chat de soporte
          </label>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Escribe el asunto de tu problema"
              className="h-12 flex-1 rounded-full border border-gray-200 px-4 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/10"
              maxLength={160}
              required
            />
            <button
              type="submit"
              disabled={submitting || !subject.trim()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Iniciar chat
            </button>
          </div>
        </form>
      ) : null}

      <div className={cn(
        "flex overflow-hidden rounded-lg border bg-white shadow-sm md:h-[calc(100vh-240px)] md:min-h-[560px]",
        activeConversation
          ? "h-[calc(100dvh-118px)] min-h-[620px] border-gray-200 shadow-none"
          : "h-[calc(100dvh-210px)] min-h-[520px] border-gray-200"
      )}>
        <aside className={cn("flex w-full flex-col border-r border-gray-200 bg-white md:w-[350px] lg:w-[390px]", activeConversation ? "hidden md:flex" : "flex")}>
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{mode === "unassigned" ? "Sin asignar" : "Chats"}</h2>
              <span className="rounded-full bg-[#f2f3f4] px-3 py-1 text-xs font-semibold text-gray-600">{sortedConversations.length}</span>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por asunto o nombre"
                className="h-11 w-full rounded-full bg-[#f2f3f4] pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-secondary/10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="animate-spin text-primary" />
                <span className="text-sm">Cargando soporte...</span>
              </div>
            ) : sortedConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-500">
                <Inbox className="mb-3 text-gray-300" size={34} />
                <p className="font-medium">{mode === "unassigned" ? "No hay conversaciones pendientes." : "No tienes conversaciones de soporte."}</p>
              </div>
            ) : (
              sortedConversations.map((conversation) => {
                const isActive = activeConversation?.id === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => (mode === "unassigned" ? setActiveConversation(conversation) : selectConversation(conversation))}
                    className={cn(
                      "mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition hover:bg-gray-50",
                      isActive && "bg-[#eef8ec] hover:bg-[#eef8ec]"
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                      {getConversationName(conversation).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-gray-900">{getConversationName(conversation)}</p>
                        <span className="shrink-0 text-xs text-gray-400">{formatDate(conversation.last_message_time || conversation.created_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-primary">{conversation.subject}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="truncate">{conversation.last_message || "Sin mensajes todavía"}</span>
                        {conversation.unread_count > 0 ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={cn("relative min-w-0 flex-1 flex-col bg-white", !activeConversation ? "hidden md:flex" : "flex")}>
          {activeConversation ? (
            <>
              <div className="flex min-h-[76px] items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 shadow-sm md:gap-3 md:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                  <button type="button" onClick={() => setActiveConversation(null)} className="rounded-full p-2 text-primary hover:bg-[#f2f3f4] md:hidden">
                    <ArrowLeft size={22} />
                  </button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white md:h-11 md:w-11 md:text-lg">
                    {getConversationName(activeConversation).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary md:hidden">
                      Chat de soporte
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold text-gray-900">{getConversationName(activeConversation)}</h3>
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusClass[activeConversation.status])}>
                        {statusLabel[activeConversation.status]}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-500">{activeConversation.subject}</p>
                  </div>
                </div>

                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  {mode === "unassigned" ? (
                    <button
                      type="button"
                      onClick={() => claimConversation(activeConversation)}
                      disabled={submitting}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60"
                    >
                      <UserRoundCheck size={16} />
                      Tomar
                    </button>
                  ) : (
                    <>
                      {isAdmin && activeConversation.status === "open" ? (
	                        <button type="button" onClick={rejectConversation} disabled={submitting} className="hidden h-10 items-center gap-2 rounded-full border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 md:inline-flex">
	                          <XCircle size={16} />
	                          Liberar
	                        </button>
	                      ) : null}
	                      {activeConversation.status === "open" ? (
	                        <button type="button" onClick={() => setFinishModalOpen(true)} disabled={submitting} className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60 md:px-4">
	                          <Lock size={16} className="shrink-0" />
	                          <span className="hidden sm:inline">Finalizar chat</span>
	                          <span className="sr-only sm:hidden">Finalizar chat</span>
	                        </button>
	                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div ref={messagesRef} className="relative flex-1 overflow-y-auto border-x border-gray-200 bg-[#f2f3f4] px-5 py-6 scrollbar-thin md:border-x-0 md:px-4 md:py-5">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-black/5 to-transparent md:hidden" />
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center text-gray-500">
                    <Loader2 className="mr-2 animate-spin text-primary" size={20} />
                    Cargando mensajes...
                  </div>
                ) : messages.length === 0 ? (
		                  <div className="mx-auto mt-6 max-w-md rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm md:mt-12 md:p-6">
                    <CircleHelp className="mx-auto mb-3 text-secondary" size={34} />
                    <h4 className="font-bold text-gray-900">Chat de soporte listo</h4>
                    <p className="mt-2 text-sm leading-6 text-gray-500">Envía el primer mensaje con los detalles del asunto para que el equipo pueda ayudarte.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const mine = String(message.sender_id) === String(user?.id);
                      return (
                        <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
	                          <div className={cn("max-w-[86%] rounded-2xl px-4 py-2 shadow-sm md:max-w-[78%]", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white text-gray-900")}>
                            {!mine ? <p className="mb-1 text-xs font-semibold text-secondary">{message.sender_name || "Soporte"}</p> : null}
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p>
                            <p className={cn("mt-1 text-right text-[11px]", mine ? "text-white/70" : "text-gray-400")}>{formatDate(message.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 bg-white p-3 pb-5 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] md:pb-3 md:shadow-none">
                <div className="mb-2 flex items-center justify-between px-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    {isConnected ? <ShieldCheck size={14} className="text-secondary" /> : <Clock size={14} />}
                    {isConnected ? "Conectado en tiempo real" : "Actualizando por historial"}
                  </span>
                  {activeConversation.admin_name ? <span>Admin: {activeConversation.admin_name}</span> : null}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={canWrite ? "Escribe un mensaje..." : "Esta conversación ya no acepta mensajes"}
                    disabled={!canWrite || submitting}
                    rows={1}
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-[#f2f3f4] px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-secondary/10 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!canWrite || submitting || !inputValue.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Enviar mensaje"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-[#f2f3f4] p-8 text-center">
              <MessageSquareText className="mb-4 text-primary" size={44} />
              <h3 className="font-[family-name:var(--font-varela-round)] text-3xl text-primary">Selecciona una conversación</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                {mode === "unassigned" ? "Toma una conversación pendiente para comenzar a responder." : "El historial y los mensajes aparecerán aquí."}
              </p>
            </div>
          )}
        </section>
      </div>

      {finishModalOpen && activeConversation ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-sm text-secondary">
                {isAdmin ? "Cerrar caso de soporte" : "Finalizar chat"}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-primary">
                {isAdmin ? "¿Cómo quieres cerrar este caso?" : "¿Tu problema quedó solucionado?"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {isAdmin
                  ? "Elige si el caso quedó solucionado o si solo debe cerrarse sin marcarlo como resuelto."
                  : "Esto nos ayuda a distinguir los casos solucionados de los chats cerrados sin solución."}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => updateStatus("resolved")}
                disabled={submitting}
                className="flex w-full items-start gap-3 rounded-lg border border-secondary/30 bg-secondary/5 p-4 text-left transition hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="mt-0.5 shrink-0 text-secondary" size={22} />
                <span>
                  <span className="block font-semibold text-primary">
                    {isAdmin ? "Marcar como solucionado" : "Sí, quedó solucionado"}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-500">
                    {isAdmin
                      ? "Registra que soporte resolvió el caso."
                      : "Cierra el chat indicando que recibiste la ayuda necesaria."}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateStatus("closed")}
                disabled={submitting}
                className="flex w-full items-start gap-3 rounded-lg border border-gray-200 p-4 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="mt-0.5 shrink-0 text-gray-500" size={22} />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {isAdmin ? "Cerrar sin solución" : "No, cerrar de todos modos"}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-500">
                    {isAdmin
                      ? "Termina el caso sin marcarlo como solucionado."
                      : "Termina la conversación aunque el problema no haya quedado solucionado."}
                  </span>
                </span>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setFinishModalOpen(false)}
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
