"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { useChat } from "@/context/ChatContext";
import { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";

export function MessagesDropdown() {
  const { user } = useAuthStore();
  const { openChat } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNew, setHasNew] = useState(false);
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

  const fetchConversations = async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setLoading(true);
    try {
      const data = await chatService.getConversations();
      // Sort by recent
      data.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setConversations(data.slice(0, 5));

      const count = data.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
      setUnreadCount(count);

      const latestTs = data.reduce((max, curr) => {
        const t = new Date(
          curr.updated_at || curr.last_message_at || curr.created_at || 0
        ).getTime();
        return t > max ? t : max;
      }, 0);

      if (typeof window !== "undefined" && user) {
        const key = `safeeasy:last_seen_chat_${user.id}`;
        const stored = window.localStorage.getItem(key);
        const lastSeen = stored ? Number(stored) : 0;

        if (!lastSeen && latestTs > 0) {
          window.localStorage.setItem(key, String(latestTs));
          setHasNew(false);
        } else if (latestTs > lastSeen && latestTs > 0) {
          setHasNew(true);
        } else {
          setHasNew(false);
        }
      }
    } catch (err) {
      console.error("Failed to load dropdown chats", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch conversations when opened
  useEffect(() => {
    if (isOpen) {
      fetchConversations(true);
    }
  }, [isOpen, user]);

  // Poll for unread messages en segundo plano
  useEffect(() => {
    if (!user) return;
    
    // Initial fetch for badge
    fetchConversations(false);
    
    const interval = setInterval(() => {
        fetchConversations(false);
    }, 7000);
    
    return () => clearInterval(interval);
  }, [user]);

  // Refrescar cuando la ventana recupera el foco (por ejemplo al volver a la pestaña)
  useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      fetchConversations(false);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);

    if (next && typeof window !== "undefined" && user) {
      const latestTs = conversations.reduce((max, curr) => {
        const t = new Date(
          curr.updated_at || curr.last_message_at || curr.created_at || 0
        ).getTime();
        return t > max ? t : max;
      }, 0);
      const key = `safeeasy:last_seen_chat_${user.id}`;
      window.localStorage.setItem(
        key,
        String(latestTs > 0 ? latestTs : Date.now())
      );
      setHasNew(false);
    }
  };

  // Helper to get name
  const getOtherPartyName = (conv: Conversation) => {
     if (user?.role === 'supplier') {
        return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
     }
     if (user?.role === 'client') {
        return conv.supplier_name || conv.other_party_name || `Proveedor #${conv.supplier_id}`;
     }
     return conv.other_party_name || conv.user_name || 'Usuario';
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleOpen}
        className={cn(
            "p-2 rounded-full transition-colors relative",
            isOpen ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-gray-600"
        )}
      >
        <div className="relative">
            <MessageSquare size={22} className={isOpen ? "fill-current" : ""} />
            {unreadCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </div>
            )}
            {unreadCount === 0 && hasNew && (
                <div className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[360px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="p-4 flex items-center justify-between border-b border-gray-50">
            <h3 className="font-bold text-xl text-gray-900">Chats</h3>
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
             ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <p>No tienes mensajes recientes.</p>
                </div>
             ) : (
                conversations.map(conv => (
                    <div 
                        key={conv.id} 
                        onClick={() => {
                            openChat(conv);
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors mx-2 rounded-lg group cursor-pointer"
                    >
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:border-white transition-colors">
                                {conv.user_image || conv.supplier_image ? (
                                    <img src={conv.user_image || conv.supplier_image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-gray-500 font-bold text-lg">
                                        {getOtherPartyName(conv).charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-[15px] truncate">
                                {getOtherPartyName(conv)}
                            </h4>
                            <div className="flex items-center gap-1 text-[13px] text-gray-500">
                                <p className={cn("truncate max-w-[160px]", (conv.unread_count || 0) > 0 && "font-semibold text-gray-900")}>
                                    {conv.last_message || "Envió un archivo adjunto."}
                                </p>
                                <span>·</span>
                                <span className="shrink-0">{formatTime(conv.updated_at)}</span>
                            </div>
                        </div>
                        {(conv.unread_count || 0) > 0 && (
                            <div className="w-3 h-3 bg-blue-600 rounded-full shrink-0"></div>
                        )}
                    </div>
                ))
             )}
          </div>
          {/* Bottom link removed as requested */}
        </div>
      )}
    </div>
  );
}
