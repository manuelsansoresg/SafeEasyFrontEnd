"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare, Search } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { useChat } from "@/context/ChatContext";
import { useChatStore } from "@/store/useChatStore";
import { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";

export function MessagesDropdown() {
  const { user } = useAuthStore();
  const { openChat } = useChat();
  const { conversations, loading, markAsRead } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Check if chat is enabled locally
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("safeeasy:chat_enabled");
      setChatEnabled(stored !== "0");
    }
  }, []);

  // Derived state for unread count
  const unreadCount = useMemo(() => {
    if (!chatEnabled) return 0;
    return conversations.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
  }, [conversations, chatEnabled]);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Helper to get name
  const getOtherPartyName = (conv: Conversation) => {
     // Safety check
     if (!user) return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;

     const myId = String(user.id);
     const supplierId = String(conv.supplier_id);
     const buyerId = String(conv.user_id || conv.buyer_id);
     
     // Construct my name for comparison
      const myName = user.name || '';

     // 1. Am I the Supplier? (Or Admin acting as Supplier)
     // If my ID matches the supplier_id, I MUST see the Client's Name.
     if (myId === supplierId || user.role === 'supplier' || user.role === 'admin') {
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
         if (conv.buyer_name && conv.buyer_name.toLowerCase() !== myName.toLowerCase()) {
             return conv.buyer_name;
         }
         
         // If buyer_name fails, try other_party_name (sometimes contains the client name)
         if (conv.other_party_name && conv.other_party_name.toLowerCase() !== myName.toLowerCase()) {
             return conv.other_party_name;
         }

         // If user_name is different from my name, use it.
         if (conv.user_name && conv.user_name.toLowerCase() !== myName.toLowerCase()) {
             return conv.user_name;
         }
         
         // Absolute last resort
         return `Cliente #${buyerId}`;
     }

     // 2. Am I the Client?
     // If my ID matches the buyer_id, I MUST see the Supplier's Name.
     if (myId === buyerId || user.role === 'client') {
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

       // 1. Am I the Supplier? -> Show Client Image
        if (myId === supplierId || user.role === 'supplier' || user.role === 'admin') {
            // Use 'any' cast to check properties not in strict interface
            const userObj = conv.user as any;
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
    } catch (e) {
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

            // 1. Identify if I am involved
            let otherId = '';
            if (supplierId === myId) {
                otherId = buyerId;
            } else if (buyerId === myId) {
                otherId = supplierId;
            } else {
                return false;
            }

            // 2. Filter out Self-Chats
            if (otherId === myId) return false;

            // 3. Deduplicate by (OtherID + ProductID)
            const key = `${otherId}-${conv.product_id || 'general'}`;
            const firstIndex = self.findIndex(c => {
                const cSupplierId = String(c.supplier_id);
                const cBuyerId = String(c.user_id || c.buyer_id);
                let cOtherId = '';
                
                if (cSupplierId === myId) cOtherId = cBuyerId;
                else if (cBuyerId === myId) cOtherId = cSupplierId;
                else return false;
                
                const cKey = `${cOtherId}-${c.product_id || 'general'}`;
                return cKey === key;
            });
            
            return firstIndex === index;
        })
        .slice(0, 5);
  }, [conversations, chatEnabled, user]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleOpen}
        className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border border-white transition-all relative",
            isOpen ? "bg-white text-primary" : "text-white hover:bg-white hover:text-primary"
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
        <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
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
              className="inline-flex items-center px-3 py-1 text-xs rounded-full border border-gray-200 hover:bg-gray-100"
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

          <div className="max-h-[400px] overflow-y-auto">
             {loading ? (
                <div className="p-8 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">Cargando...</span>
                </div>
             ) : displayConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No tienes mensajes recientes.</p>
                </div>
             ) : (
                displayConversations.map(conv => {
                    const unread = conv.unread_count || 0;
                    const isNew = unread > 0;

                    return (
                    <div 
                        key={conv.id}
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
                                {/* Product title removed for suppliers as requested */}
                                {!user || (user.role !== 'supplier' && user.role !== 'admin') && conv.product_title && (
                                    <span className="text-[11px] font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                                        {conv.product_title}
                                    </span>
                                )}
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
