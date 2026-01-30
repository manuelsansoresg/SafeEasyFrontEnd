"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { Conversation, Message } from "@/types/chat";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { Send, Search, MessageSquare, Info, Package, Check, CheckCheck, FileText, Download, Image as ImageIcon } from "lucide-react";

function MessagesContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get('conversation_id');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // WebSocket hook
  const { lastMessage, sendMessage: wsSendMessage } = useChatWebSocket(activeConversation?.id, !!activeConversation);

  // Load conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await chatService.getConversations();
        // Sort by recent activity
        data.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });
        setConversations(data);
        
        // Select conversation from URL if present
        if (initialConversationId) {
          const found = data.find(c => String(c.id) === String(initialConversationId));
          if (found) {
            setActiveConversation(found);
          }
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversation) return;

    const loadMessages = async () => {
      try {
        const history = await chatService.getMessages(activeConversation.id);
        setMessages(history);
        scrollToBottom();
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();
  }, [activeConversation]);

  // Sync WebSocket messages
  useEffect(() => {
    if (lastMessage && activeConversation) {
      if (String(lastMessage.conversation_id) === String(activeConversation.id)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === lastMessage.id)) return prev;
          return [...prev, lastMessage];
        });
        scrollToBottom();
      }
    }
  }, [lastMessage, activeConversation]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
        setTimeout(() => {
            const container = messagesContainerRef.current;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeConversation) return;

    setSending(true);
    try {
        // Try WebSocket first
        wsSendMessage(inputValue, activeConversation.id);
        setInputValue("");
        scrollToBottom();
    } catch (error) {
        console.error("Error sending message:", error);
        // Fallback or error handling
    } finally {
        setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to get other party info
  const getOtherPartyName = (conv: Conversation) => {
     if (user?.role === 'supplier') {
        return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
     }
     // If admin viewing, might be tricky, but assuming similar logic
     return conv.other_party_name || conv.user_name || 'Usuario';
  };
  
  const getOtherPartyImage = (conv: Conversation) => {
      return conv.user_image || null;
  };

  // Helper for date formatting
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(date);
        } else if (days === 1) {
            return 'Ayer';
        } else {
            return new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' }).format(date);
        }
    } catch (e) {
        return '';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
        return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
    } catch (e) {
        return '';
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      {/* Sidebar - Conversations List */}
      <div className="w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col bg-white z-20">
        <div className="p-4 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Mensajes</h2>
          <div className="relative group">
            <input
              type="text"
              placeholder="Buscar conversación..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
            <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-primary transition-colors" size={16} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
             <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Cargando chats...</span>
             </div>
          ) : conversations.length === 0 ? (
             <div className="p-10 text-center text-gray-400 flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <MessageSquare size={24} className="opacity-40" />
                </div>
                <p className="font-medium text-gray-600">No hay mensajes</p>
                <p className="text-xs mt-1">Tus conversaciones aparecerán aquí</p>
             </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-all border-b border-gray-50 group ${
                  activeConversation?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-sm border border-white">
                        {getOtherPartyImage(conv) ? (
                            <img src={getOtherPartyImage(conv)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-gray-500 font-bold text-lg">
                                {getOtherPartyName(conv).charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    {/* Online status indicator placeholder */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`font-semibold text-sm truncate pr-2 ${activeConversation?.id === conv.id ? 'text-primary' : 'text-gray-900'}`}>
                        {getOtherPartyName(conv)}
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400 shrink-0">
                        {formatDate(conv.updated_at || conv.created_at)}
                    </span>
                  </div>
                  
                  {/* Product context in list */}
                  {conv.product_title && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <Package size={10} className="shrink-0" />
                          <span className="truncate max-w-[150px]">{conv.product_title}</span>
                      </div>
                  )}

                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {conv.last_message ? (
                        <>
                            <span className="opacity-70">{conv.last_message}</span>
                        </>
                    ) : (
                        <span className="italic opacity-50">Nueva conversación</span>
                    )}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#F8F9FA] relative">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm z-10 flex flex-col">
                {/* Top Row: User Info & Actions */}
                <div className="h-16 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 text-lg border border-primary/20">
                            {getOtherPartyName(activeConversation).charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg leading-tight">
                                {getOtherPartyName(activeConversation)}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                                <p className="text-xs text-gray-500">En línea</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                        {/* Removed Phone and Video icons as requested */}
                        <button className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-primary" title="Ver perfil">
                            <Info size={20} />
                        </button>
                    </div>
                </div>
                
                {/* Bottom Row: Product Context (The "Inferior" bar) */}
                {activeConversation.product_title && (
                    <div className="px-6 py-2.5 bg-blue-50/50 flex items-center gap-3">
                        <div className="p-1.5 bg-white rounded-md border border-gray-200 shrink-0">
                            <Package size={16} className="text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Interesado en producto</span>
                            <span className="text-sm font-medium text-gray-800 truncate" title={activeConversation.product_title}>
                                {activeConversation.product_title}
                            </span>
                        </div>
                        <button className="ml-auto text-xs font-medium text-primary hover:underline whitespace-nowrap px-3 py-1 bg-white rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-colors">
                            Ver Producto
                        </button>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8F9FA] scroll-smooth"
            >
               {messages.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                       <span className="text-sm bg-gray-100 px-4 py-1 rounded-full">Inicio de la conversación</span>
                   </div>
               )}
               
               {messages.map((msg, idx) => {
                 const isMe = String(msg.sender_id) === String(user?.id);
                 // Check if previous message was from same sender to group bubbles
                 const isSequence = idx > 0 && String(messages[idx-1].sender_id) === String(msg.sender_id);
                 
                 return (
                   <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                     <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`px-5 py-3 shadow-sm text-[15px] leading-relaxed relative group-hover:shadow-md transition-shadow ${
                          isMe 
                            ? 'bg-primary text-white rounded-2xl rounded-tr-sm' 
                            : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
                        } ${isSequence ? (isMe ? 'mt-1' : 'mt-1') : 'mt-0'}`}>
                          {/* Attachments */}
                          {msg.attachment_url && (
                            <div className="mb-2">
                                {msg.message_type === 'image' || (msg.attachment_url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                    <div className="relative rounded-lg overflow-hidden mb-1 border border-black/10">
                                        <img 
                                            src={msg.attachment_url} 
                                            alt="Adjunto" 
                                            className="max-w-full h-auto max-h-60 object-cover cursor-pointer"
                                            onClick={() => window.open(msg.attachment_url, '_blank')}
                                        />
                                    </div>
                                ) : (
                                    <a 
                                        href={msg.attachment_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                                            isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                        } transition-colors`}
                                    >
                                        <div className={`p-2 rounded-full ${isMe ? 'bg-white/20' : 'bg-gray-200'}`}>
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate opacity-90">Archivo adjunto</p>
                                            <p className="text-xs opacity-70">Clic para descargar</p>
                                        </div>
                                        <Download size={16} className="opacity-70" />
                                    </a>
                                )}
                            </div>
                          )}
                          
                          {/* Text Content */}
                          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? 'text-gray-400 mr-1' : 'text-gray-400 ml-1'}`}>
                             <span>{formatTime(msg.created_at)}</span>
                             {isMe && (
                                 <CheckCheck size={12} className={msg.is_read ? "text-primary" : "text-gray-300"} />
                             )}
                        </div>
                     </div>
                   </div>
                 );
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
               <div className="max-w-4xl mx-auto flex items-end gap-3">
                 <div className="flex-1 bg-gray-50 rounded-2xl p-1.5 border border-gray-200 focus-within:border-primary focus-within:bg-white transition-all shadow-sm">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Escribe un mensaje..."
                        className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none max-h-32 min-h-[44px] py-2.5 px-3 text-gray-800 placeholder-gray-400 leading-relaxed"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                 </div>
                 <button 
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sending}
                    className="p-3.5 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                 >
                    <Send size={20} className={sending ? "opacity-50" : ""} />
                 </button>
               </div>
               <div className="text-center mt-2">
                    <p className="text-[10px] text-gray-400">Presiona Enter para enviar</p>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                <MessageSquare size={48} className="text-primary/20" />
            </div>
            <h3 className="text-2xl font-bold text-gray-700 mb-3">Tus Mensajes</h3>
            <p className="text-gray-500 max-w-md text-center leading-relaxed">
                Selecciona una conversación de la lista lateral para ver el historial completo y chatear con tus clientes en tiempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando mensajes...</div>}>
      <MessagesContent />
    </Suspense>
  );
}