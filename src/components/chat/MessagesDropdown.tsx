"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LifeBuoy, MessageSquare, Search } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useChat } from "@/context/ChatContext";
import { useChatStore } from "@/store/useChatStore";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import { markSupportConversationReadLocally, supportChatService } from "@/services/supportChatService";
import type { SupportConversation } from "@/types/support-chat";
import { useRouter } from "next/navigation";

type DropdownItem =
  | { type: "marketplace"; conversation: Conversation; date: string; unread: number }
  | { type: "support"; conversation: SupportConversation; date: string; unread: number };

export function MessagesDropdown() {
  const { user, token } = useAuthStore();
  const { openChat } = useChat();
  const { conversations, loading, markAsRead, fetchConversations } = useChatStore();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("safeeasy:chat_enabled") !== "0";
  });
  const [supportConversations, setSupportConversations] = useState<SupportConversation[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useChatInboxWebSocket(chatEnabled && !!token);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!chatEnabled || !token) return;
    fetchConversations();
  }, [chatEnabled, token, fetchConversations]);

  const loadSupportConversations = useCallback(() => {
    if (!chatEnabled || !token || !user) {
      return () => {};
    }

    let disposed = false;
    supportChatService
      .getConversations()
      .then((items) => {
        if (!disposed) setSupportConversations(items);
      })
      .catch(() => {
        if (!disposed) setSupportConversations([]);
      });

    return () => {
      disposed = true;
    };
  }, [chatEnabled, token, user]);

  useEffect(() => loadSupportConversations(), [loadSupportConversations]);

  useEffect(() => {
    const handleRead = (event: Event) => {
      const conversationId = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!conversationId) return;
      setSupportConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation
        )
      );
    };

    window.addEventListener("support-chat-read", handleRead);
    return () => window.removeEventListener("support-chat-read", handleRead);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const cleanup = loadSupportConversations();
    fetchConversations();
    return cleanup;
  }, [fetchConversations, isOpen, loadSupportConversations]);

  useEffect(() => {
    if (!chatEnabled || !token || !user) return;
    const interval = window.setInterval(() => {
      loadSupportConversations();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [chatEnabled, loadSupportConversations, token, user]);

  // Derived state for unread count
  const unreadCount = useMemo(() => {
    if (!chatEnabled || !user) return 0;
    const marketplaceUnread = conversations
      .filter(c => {
        // Filter out self-chats from unread count
        const myId = String(user.id);
        const supplierId = String(c.supplier_id);
        const buyerId = String(c.user_id || c.buyer_id);
        const effectiveMyRole =
          c.my_role ||
          (supplierId === myId ? "supplier" : buyerId === myId ? "client" : undefined);
        const userIsSupplier = user.role === "supplier" || user.role === "admin";

        if (userIsSupplier && effectiveMyRole !== "supplier") return false;
        return !(supplierId === myId && buyerId === myId);
      })
      .reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
    const supportUnread = supportConversations.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
    return marketplaceUnread + supportUnread;
  }, [conversations, chatEnabled, supportConversations, user]);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Helper to get name
  const getOtherPartyName = (conv: Conversation) => {
     // Safety check
     if (!user) return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;

     const myId = String(user.id);
     const supplierId = String(conv.supplier_id);
     const buyerId = String(conv.user_id || conv.buyer_id);
     
     // Construct my name for comparison
      const myName = (user.name || '').trim();
     const effectiveMyRole =
       conv.my_role ||
       (myId === supplierId ? "supplier" : myId === buyerId ? "client" : undefined);

     // 1. Am I the Supplier? (Or Admin acting as Supplier)
     // If my ID matches the supplier_id, I MUST see the Client's Name.
     if (
       effectiveMyRole === "supplier" ||
       myId === supplierId ||
       user.role === "supplier" ||
       user.role === "admin"
     ) {
         if (conv.buyer_name && conv.buyer_name.trim()) {
             return conv.buyer_name;
         }

         // Check structured user object first
         if (conv.user) {
             const convUserId = String(conv.user.id);
             // CRITICAL: Only use conv.user if it is NOT me.
             if (convUserId !== myId) {
                 const name = conv.user.name || `${conv.user.first_name || ''} ${conv.user.last_name || ''}`.trim();
                 if (name && name.toLowerCase() !== myName.toLowerCase()) return name;
             }
         }
         
         // Fallback to flat fields
         // PRIORITIZE buyer_name, as that is explicitly the client.
         // Use user_name if different from me
         if (conv.user_name && conv.user_name.trim() && conv.user_name.trim().toLowerCase() !== myName.toLowerCase()) {
             return conv.user_name;
         }
         
         // IGNORE supplier_name completely for suppliers.
         // CHECK other_party_name carefully.
         if (conv.other_party_name) {
             const opName = conv.other_party_name.trim().toLowerCase();
             // If other_party_name is NOT me, and NOT the supplier name (which is likely me)
             const sName = (conv.supplier_name || '').trim().toLowerCase();
             
             if (opName !== myName.toLowerCase() && opName !== sName) {
                 return conv.other_party_name;
             }
         }
         
         // Absolute last resort
         return `Cliente #${buyerId}`;
     }

     // 2. Am I the Client?
     // If my ID matches the buyer_id, I MUST see the Supplier's Name.
     if (effectiveMyRole === "client" || myId === buyerId || user.role === 'client') {
         return conv.supplier_name || conv.other_party_name || `Proveedor #${supplierId}`;
     }

     // 3. Fallback / Default
     // If I am neither (or data is weird), default to showing the Client Name (safest for Admin/Supplier view)
     return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
   };

   const getOtherPartyImage = (conv: Conversation) => {
       if (!user) return conv.user_image || null;

       const myId = String(user.id);
       const supplierId = String(conv.supplier_id);
       const buyerId = String(conv.user_id || conv.buyer_id);
       const effectiveMyRole =
         conv.my_role ||
         (myId === supplierId ? "supplier" : myId === buyerId ? "client" : undefined);

       // 1. Am I the Supplier? -> Show Client Image
        if (
          effectiveMyRole === "supplier" ||
          myId === supplierId ||
          user.role === "supplier" ||
          user.role === "admin"
        ) {
            const userObj = conv.user;
            if (userObj && String(userObj.id) !== myId) {
                return userObj.image || userObj.avatar || conv.user_image || null;
            }
            // If user object matches me, or is missing, fall back to user_image ONLY if buyerId is not me
            if (buyerId !== myId) {
                 return conv.user_image || null;
            }
            return null; 
        }

       // 2. Am I the Client? -> Show Supplier Image
       if (myId === buyerId || user.role === 'client') {
           return conv.supplier_image || null;
       }

       return conv.user_image || null;
   };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(date);
        } else if (days < 7) {
            return new Intl.DateTimeFormat('es', { weekday: 'short' }).format(date);
        } else {
            return new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' }).format(date);
        }
    } catch {
        return '';
    }
  };

  const displayConversations = useMemo(() => {
    if (!chatEnabled || !user) return [];
    
    return conversations
        .filter((conv, index, self) => {
            const myId = String(user.id);
            const supplierId = String(conv.supplier_id);
            const buyerId = String(conv.user_id || conv.buyer_id);
            const effectiveMyRole =
              conv.my_role ||
              (supplierId === myId ? "supplier" : buyerId === myId ? "client" : undefined);
            const userIsSupplier = user.role === "supplier" || user.role === "admin";

            if (userIsSupplier) {
                if (effectiveMyRole !== "supplier") return false;
            }

            // 1. Identify if I am involved
            let otherId = '';
            if (supplierId === myId) otherId = buyerId;
            else if (buyerId === myId) otherId = supplierId;
            else if (effectiveMyRole === "supplier") otherId = buyerId;
            else if (effectiveMyRole === "client") otherId = supplierId;
            else return false;

            // 2. Filter out Self-Chats
            if (otherId === myId) return false;

            // 3. Deduplicate by OtherID ONLY (Merge multiple product chats from same person)
            const key = otherId;
            const firstIndex = self.findIndex(c => {
                const cSupplierId = String(c.supplier_id);
                const cBuyerId = String(c.user_id || c.buyer_id);
                const cEffectiveMyRole =
                  c.my_role ||
                  (cSupplierId === myId ? "supplier" : cBuyerId === myId ? "client" : undefined);
                let cOtherId = '';
                
                if (cSupplierId === myId) cOtherId = cBuyerId;
                else if (cBuyerId === myId) cOtherId = cSupplierId;
                else if (cEffectiveMyRole === "supplier") cOtherId = cBuyerId;
                else if (cEffectiveMyRole === "client") cOtherId = cSupplierId;
                else return false;
                
                // Compare only the other party ID
                return cOtherId === key;
            });
            
            return firstIndex === index;
        })
        .slice(0, 5);
  }, [conversations, chatEnabled, user]);

  const displayItems = useMemo<DropdownItem[]>(() => {
    if (!chatEnabled || !user) return [];

    const marketplaceItems: DropdownItem[] = displayConversations.map((conversation) => ({
      type: "marketplace",
      conversation,
      date: conversation.updated_at || conversation.created_at || "",
      unread: conversation.unread_count || 0,
    }));

    const supportItems: DropdownItem[] = supportConversations.map((conversation) => ({
      type: "support",
      conversation,
      date: conversation.last_message_time || conversation.created_at || "",
      unread: conversation.unread_count || 0,
    }));

    return [...supportItems, ...marketplaceItems]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 6);
  }, [chatEnabled, displayConversations, supportConversations, user]);

  const getSupportName = (conv: SupportConversation) => {
    const role = String(user?.role || "").toLowerCase();
    if (role === "admin" || role === "superuser") return conv.user_name || `Usuario #${conv.user_id}`;
    return conv.admin_name || "Soporte Drooopy";
  };

  const openSupportConversation = (conv: SupportConversation) => {
    const role = String(user?.role || "").toLowerCase();
    const basePath = role === "admin" || role === "superuser" ? "/admin/support" : "/support";
    markSupportConversationReadLocally(conv);
    supportChatService.markAsRead(conv.id).catch(() => {});
    setSupportConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conv.id ? { ...conversation, unread_count: 0 } : conversation
      )
    );
    setIsOpen(false);
    router.push(`${basePath}/${conv.id}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleOpen}
        className={cn(
            "flex items-center justify-center h-10 px-2 transition-all relative",
            isOpen ? "text-[#7ed957]" : "text-white hover:text-[#7ed957]"
        )}
      >
        <div className="relative">
            <MessageSquare size={20} className={isOpen ? "fill-current" : ""} />
            {chatEnabled && unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </div>
            )}
            {!chatEnabled && (
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-gray-400 rounded-full border-2 border-white" />
            )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-96 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-[10050] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="p-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="font-bold text-xl text-gray-900">Chats</h3>
              <p className="text-xs text-gray-500">
                Estado: {chatEnabled ? "Activo" : "Pausado"}
              </p>
            </div>
            <button
              onClick={() => {
                setChatEnabled((prev) => {
                  const next = !prev;
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      "safeeasy:chat_enabled",
                      next ? "1" : "0"
                    );
                  }
                  return next;
                });
              }}
              className={cn(
                "inline-flex items-center px-3 py-1 text-xs rounded-full border transition-colors",
                chatEnabled
                  ? "border-[#168E00] text-[#168E00] hover:bg-[#168E00]/10"
                  : "bg-[#168E00] border-[#168E00] text-white hover:bg-[#137500]"
              )}
            >
              {chatEnabled ? "Pausar chat" : "Activar chat"}
            </button>
          </div>
          
          <div className="px-4 py-2">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar en Messenger" 
                    className="w-full bg-gray-100 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
             </div>
          </div>

          <div className="max-h-[min(400px,calc(100vh-260px))] overflow-y-auto">
             {loading ? (
                <div className="p-8 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">Cargando...</span>
                </div>
             ) : displayItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No tienes mensajes recientes.</p>
                </div>
             ) : (
                displayItems.map(item => {
                    if (item.type === "support") {
                      const conv = item.conversation;
                      const isNew = item.unread > 0;
                      return (
                        <div
                          key={`support-${conv.id}`}
                          onClick={() => openSupportConversation(conv)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors mx-2 rounded-lg group cursor-pointer"
                        >
                          <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center overflow-hidden border border-primary/10 text-white">
                              <LifeBuoy size={24} />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#168e00] px-1.5 py-0.5 text-[9px] font-bold text-white">
                              Soporte
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-[15px] truncate flex items-center gap-1">
                              <span className="truncate">{getSupportName(conv)}</span>
                            </h4>
                            <div className="flex items-center gap-1 text-[13px] text-gray-500">
                              <p className={cn("truncate max-w-[160px]", isNew && "font-semibold text-gray-900")}>
                                {conv.last_message || conv.subject}
                              </p>
                              <span>·</span>
                              <span className="shrink-0">{formatTime(item.date)}</span>
                            </div>
                          </div>
                          {isNew && <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>}
                        </div>
                      );
                    }

                    const conv = item.conversation;
                    const unread = item.unread;
                    const isNew = unread > 0;

                    return (
                    <div 
                        key={`marketplace-${conv.id}`}
                        onClick={() => {
                            openChat(conv);
                            setIsOpen(false);
                            // Mark as read in global store
                            markAsRead(conv.id);
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors mx-2 rounded-lg group cursor-pointer"
                    >
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:border-white transition-colors">
                                {getOtherPartyImage(conv) ? (
                                    <img src={getOtherPartyImage(conv)!} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-gray-500 font-bold text-lg">
                                        {getOtherPartyName(conv).charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-[15px] truncate flex items-center gap-1">
                                <span className="truncate">{getOtherPartyName(conv)}</span>
                            </h4>
                            <div className="flex items-center gap-1 text-[13px] text-gray-500">
                                <p className={cn(
                                    "truncate max-w-[160px]",
                                    isNew && "font-semibold text-gray-900"
                                )}>
                                    {conv.last_message || "Envió un archivo adjunto."}
                                </p>
                                <span>·</span>
                                <span className="shrink-0">{formatTime(conv.updated_at)}</span>
                            </div>
                        </div>
                        {isNew && (
                            <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
                        )}
                    </div>
                )})
             )}
          </div>
          {/* Bottom link removed as requested */}
        </div>
      )}
    </div>
  );
}
