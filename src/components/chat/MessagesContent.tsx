"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { Conversation, Message } from "@/types/chat";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { fetchWithAuth } from "@/lib/api";
import { 
  Send, Search, MessageSquare, Info, Package, CheckCheck, 
  FileText, Download, Image as ImageIcon, CreditCard, Loader2, Paperclip, X,
  MoreHorizontal, Phone, Video, Smile, PlusCircle, ShoppingBag, ChevronRight, Clock
} from "lucide-react";
import Image from "next/image";

// Local interfaces for product data
interface ProductDetail {
  id: string;
  title: string;
  price: number;
  image: string | null;
  slug?: string;
  min_order_quantity?: number;
  supplier?: {
    id: number;
    name?: string;
    transfer_clabe?: string | null;
    transfer_bank?: string | null;
    transfer_name?: string | null;
    transfer_accepted?: boolean;
  };
}

// Interface for Product Card Message Payload
interface ProductCardPayload {
  type: 'product_card';
  product_id: string | number;
  title: string;
  price: number;
  image: string | null;
  min_order?: number;
}

export function MessagesContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL Params
  const paramConversationId = searchParams.get('conversation_id');
  const paramSupplierId = searchParams.get('supplier_id');
  const paramProductId = searchParams.get('product_id');

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Product & Payment State
  const [productData, setProductData] = useState<ProductDetail | null>(null);
  const [recentProducts, setRecentProducts] = useState<ProductDetail[]>([]); // For history
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WebSocket hook
  const { lastMessage, sendMessage: wsSendMessage } = useChatWebSocket(activeConversation?.id, !!activeConversation);

  // Helper to get absolute URL (for images/files)
  const getAbsoluteUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http') || url.startsWith('blob:')) return url;
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
      return `${apiBase.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // 1. Load Conversations & Handle Initialization
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const data = await chatService.getConversations();
        
        // Sort by recent activity
        data.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });
        
        setConversations(data);
        
        let targetConv: Conversation | undefined;

        // A. Priority: Explicit Conversation ID
        if (paramConversationId) {
          targetConv = data.find(c => String(c.id) === String(paramConversationId));
        }
        
        // B. Fallback: Supplier ID + Product ID (Direct Chat from Product Page)
        if (!targetConv && paramSupplierId && paramProductId) {
             // 1. Search existing
             targetConv = data.find(c => 
                 (String(c.supplier_id) === String(paramSupplierId) || String(c.buyer_id) === String(paramSupplierId)) && // Check participant
                 String(c.product_id) === String(paramProductId)
             );

             // 2. Create if not exists (only if client)
             if (!targetConv && user.role === 'client') {
                 console.log("Creating new conversation for product/supplier...");
                 try {
                     const newConv = await chatService.createConversation({
                         supplier_id: Number(paramSupplierId),
                         product_id: paramProductId
                     });
                     // Add to local list
                     setConversations(prev => [newConv, ...prev]);
                     targetConv = newConv;
                 } catch (err) {
                     console.error("Failed to create conversation:", err);
                     setError("No se pudo crear la conversación.");
                 }
             }
        }

        if (targetConv) {
          setActiveConversation(targetConv);
        }

      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, paramConversationId, paramSupplierId, paramProductId]);

  // 2. Load Messages when Active Conversation Changes
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
    
    // Also fetch product data if available
    if (activeConversation.product_id) {
        fetchProductDetails(activeConversation.product_id);
    } else {
        setProductData(null);
    }

    // Load Local History (Mock for now, requires backend for true cross-device history)
    loadLocalHistory();

  }, [activeConversation]);

  const loadLocalHistory = () => {
      // Try to load from localStorage 'safeeasy_open_chats' to simulate history
      if (typeof window !== 'undefined') {
          try {
              const stored = localStorage.getItem('safeeasy_open_chats');
              if (stored) {
                  const chats: any[] = JSON.parse(stored);
                  // Filter chats related to this supplier (if possible) or just show recent
                  // For now, let's just show recent unique products
                  const uniqueProducts = new Map();
                  chats.forEach(c => {
                      if (c.product_id && c.product_title) {
                          uniqueProducts.set(c.product_id, {
                              id: c.product_id,
                              title: c.product_title,
                              price: c.product_price || 0,
                              image: c.product_image,
                              slug: c.product_slug
                          });
                      }
                  });
                  setRecentProducts(Array.from(uniqueProducts.values()));
              }
          } catch (e) {
              console.error("Failed to load local history", e);
          }
      }
  };

  // Fetch Product & Supplier Details
  const fetchProductDetails = async (productId: string | number) => {
      try {
          const res = await fetchWithAuth(`/api/products/${productId}`);
          if (res.ok) {
              const data = await res.json();
              
              // If supplier data is missing or incomplete, try to fetch it
              if ((!data.supplier || !data.supplier.transfer_accepted) && activeConversation?.supplier_id) {
                  try {
                      // Try fetching supplier specific data (assuming endpoint exists, or fallback to user)
                      const suppRes = await fetchWithAuth(`/api/users/${activeConversation.supplier_id}`);
                      if (suppRes.ok) {
                          const suppData = await suppRes.json();
                          data.supplier = {
                              ...data.supplier,
                              ...suppData,
                              transfer_accepted: suppData.transfer_accepted ?? data.supplier?.transfer_accepted
                          };
                      }
                  } catch (e) {
                      console.warn("Could not fetch extra supplier details", e);
                  }
              }
              
              setProductData(data);
          }
      } catch (err) {
          console.error("Failed to fetch product details:", err);
      }
  };

  // 3. Sync WebSocket messages
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
    if ((!inputValue.trim() && !selectedFile) || !activeConversation) return;

    setSending(true);
    try {
        // Handle file upload if present
        // Note: We use the basic sendMessage for now.
        
        wsSendMessage(inputValue, activeConversation.id);
        setInputValue("");
        setSelectedFile(null);
        scrollToBottom();
    } catch (error) {
        console.error("Error sending message:", error);
    } finally {
        setSending(false);
    }
  };

  // Send a Product Card Message
  const handleSendProduct = async (product: ProductDetail) => {
      if (!activeConversation) return;
      
      setSending(true);
      try {
          // Construct a rich payload
          // Since backend might not support structured JSON in 'content' field natively for rendering,
          // we use a convention: JSON string starting with { "type": "product_card" ... }
          const payload: ProductCardPayload = {
              type: 'product_card',
              product_id: product.id,
              title: product.title,
              price: product.price,
              image: product.image,
              min_order: product.min_order_quantity
          };
          
          // We use the REST endpoint we modified to support product_id
          await chatService.sendMessage(
              activeConversation.id, 
              JSON.stringify(payload), // Send JSON as content
              'text', 
              undefined, 
              product.id // Also pass product_id for backend context
          );
          
          // Optimistic update? No, let WS handle it or reload
          // But to be responsive:
          const tempMsg: Message = {
              id: Date.now(),
              conversation_id: activeConversation.id,
              sender_id: user?.id || 0,
              content: JSON.stringify(payload),
              created_at: new Date().toISOString(),
              message_type: 'text',
              is_read: false
          };
          setMessages(prev => [...prev, tempMsg]);
          scrollToBottom();
          
      } catch (err) {
          console.error("Failed to send product card", err);
          setError("Error al enviar la referencia del producto.");
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

  const handlePaymentClick = async () => {
    // 1. Validate dependencies
    if (!user?.role) {
       console.error("User role not found");
       return;
    }

    if (!productData?.supplier?.transfer_accepted) {
        setError("El proveedor aún no ha configurado sus datos de pago o transferencia.");
        return;
    }

    // Use activeConversation info or productData as fallback
    const targetSupplierId = activeConversation?.supplier_id || productData?.supplier?.id;
    const targetProductId = activeConversation?.product_id || productData?.id;

    if (!targetSupplierId) {
        console.error("Missing supplier info");
        setError("Error: Información del proveedor incompleta.");
        return;
    }

    // 2. Ensure conversation exists
    let targetConversationId = activeConversation?.id;

    if (!targetConversationId) {
        console.log("No active conversation found. Attempting to create one...");
        try {
            const newConv = await chatService.createConversation({
                supplier_id: Number(targetSupplierId),
                product_id: targetProductId ? String(targetProductId) : undefined
            });
            targetConversationId = newConv.id;
            setActiveConversation(newConv);
        } catch (err) {
             console.error("Failed to create conversation for order:", err);
             setError("Error: No se pudo iniciar la conversación para el pedido.");
             return;
        }
    }
    
    setIsCreatingOrder(true);
    setError(null);
    try {
        const payload = {
            supplier_id: Number(targetSupplierId),
            product_id: targetProductId ? String(targetProductId) : undefined, 
            conversation_id: String(targetConversationId),
            status: "pending"
        };
        
        console.log("Creating order with payload:", payload);

        const res = await fetchWithAuth('/api/orders/', {
             method: 'POST',
             body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        console.log("Order creation response:", data);

        if (res.ok) {
            setCreatedOrderId(data.id || data.order_id || null);
            setIsPaymentModalOpen(true);
        } else {
            console.error("Failed to create order:", data);
            setError(data.message || data.error || "No se pudo iniciar el proceso de pago. Intenta de nuevo.");
        }
    } catch (error) {
        console.error("Error creating order", error);
        setError("Error al procesar la solicitud de pago. Verifica tu conexión.");
    } finally {
        setIsCreatingOrder(false);
    }
  };

  // UI Helpers
  const getOtherPartyName = (conv: Conversation) => {
     // 1. Try to use backend-provided role if available
     if (conv.my_role === 'supplier') {
         return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
     }
     if (conv.my_role === 'client') {
         return conv.supplier_name || conv.other_party_name || `Proveedor #${conv.supplier_id}`;
     }

     // 2. Fallback: Check IDs against current user
     if (user) {
         const userIdStr = String(user.id);
         const supplierIdStr = String(conv.supplier_id);
         const buyerIdStr = String(conv.user_id || conv.buyer_id);
         
         // If I am the supplier, show buyer
         if (supplierIdStr === userIdStr) {
             return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
         }
         // If I am the buyer, show supplier
         if (buyerIdStr === userIdStr) {
             return conv.supplier_name || conv.other_party_name || `Proveedor #${conv.supplier_id}`;
         }
     }

     // 3. Last resort: Global role (legacy behavior)
     if (user?.role === 'supplier') {
        return conv.user_name || conv.buyer_name || `Usuario #${conv.user_id}`;
     }
     if (user?.role === 'client') {
        return conv.supplier_name || conv.other_party_name || `Proveedor #${conv.supplier_id}`;
     }
     return conv.other_party_name || conv.user_name || 'Usuario';
  };
  
  const getOtherPartyImage = (conv: Conversation) => {
      return conv.user_image || conv.supplier_image || null;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(date);
        if (days === 1) return 'Ayer';
        return new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' }).format(date);
    } catch (e) { return ''; }
  };

  // Message Parser to handle Product Cards
  const parseMessageContent = (content: string) => {
      try {
          if (content.trim().startsWith('{')) {
              const data = JSON.parse(content);
              if (data.type === 'product_card') {
                  return { type: 'product_card', data };
              }
          }
      } catch (e) {
          // Not JSON
      }
      return { type: 'text', content };
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden font-sans">
      {/* Sidebar - Conversations List */}
      <div className={`w-full md:w-[320px] lg:w-[360px] border-r border-gray-200 flex flex-col bg-white z-20 ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 px-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Chats</h2>
            <div className="flex gap-2">
                <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <MoreHorizontal size={20} className="text-gray-700" />
                </button>
            </div>
          </div>
          <div className="relative group">
            <input
              type="text"
              placeholder="Buscar en Messenger"
              className="w-full pl-10 pr-4 py-2.5 bg-[#F0F2F5] rounded-full focus:outline-none focus:ring-0 transition-all text-sm placeholder-gray-500"
            />
            <Search className="absolute left-3.5 top-3 text-gray-500" size={18} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
          {loading ? (
             <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm">Cargando chats...</span>
             </div>
          ) : conversations.length === 0 ? (
             <div className="p-10 text-center text-gray-400 flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <MessageSquare size={24} className="opacity-40" />
                </div>
                <p className="font-medium text-gray-600">No hay mensajes</p>
             </div>
          ) : (
            conversations
            .filter(conv => {
                // Filter out self-chats or invalid chats
                if (String(conv.supplier_id) === String(conv.user_id || conv.buyer_id)) return false;
                
                // Also filter if I am BOTH the supplier AND the buyer (just in case IDs are confusing)
                if (user) {
                    const myId = String(user.id);
                    if (String(conv.supplier_id) === myId && String(conv.user_id || conv.buyer_id) === myId) return false;
                }
                
                return true;
            })
            .map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-all group mb-1 ${
                  activeConversation?.id === conv.id ? 'bg-[#EBF5FF] hover:bg-[#EBF5FF]' : ''
                }`}
              >
                <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100">
                        {getOtherPartyImage(conv) ? (
                            <img src={getOtherPartyImage(conv)!} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-gray-500 font-bold text-lg">
                                {getOtherPartyName(conv).charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    {/* Status Dot (Fake for now) */}
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <h3 className={`font-medium text-[15px] truncate mb-0.5 flex flex-col ${activeConversation?.id === conv.id ? 'text-gray-900' : 'text-gray-900'}`}>
                      <span>{getOtherPartyName(conv)}</span>
                      {/* Only show product title if I am NOT the supplier of this conversation */}
                      {conv.product_title && 
                       user?.role !== 'supplier' && 
                       user?.role !== 'vendor' && 
                       String(conv.supplier_id) !== String(user?.id) && (
                          <span className="text-[11px] text-gray-500 font-normal truncate">
                              {conv.product_title}
                          </span>
                      )}
                  </h3>
                  <div className="flex items-center gap-1 text-[13px] text-gray-500 truncate">
                     <span className={`truncate ${!(conv as any).is_read ? 'font-semibold text-gray-900' : ''}`}>
                         {conv.last_message || 'Inició chat'}
                     </span>
                     <span className="shrink-0 mx-1">·</span>
                     <span className="shrink-0 text-gray-400">
                        {formatDate(conv.updated_at || conv.created_at)}
                     </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white relative ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white px-4 py-3 border-b border-gray-200 shadow-sm z-10 flex items-center justify-between h-[68px]">
                <div className="flex items-center gap-3">
                    {/* Mobile Back Button */}
                    <button 
                        className="md:hidden p-2 -ml-2 text-primary hover:bg-blue-50 rounded-full"
                        onClick={() => setActiveConversation(null)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>

                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold shrink-0 text-lg overflow-hidden">
                            {getOtherPartyImage(activeConversation) ? (
                                <img src={getOtherPartyImage(activeConversation)!} alt="" className="w-full h-full object-cover" />
                            ) : (
                                getOtherPartyName(activeConversation).charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    
                    <div className="flex flex-col justify-center">
                        <h3 className="font-semibold text-[17px] text-gray-900 leading-tight">
                            {getOtherPartyName(activeConversation)}
                        </h3>
                        <p className="text-[12px] text-gray-500 leading-none mt-0.5">Activo ahora</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Toggle Sidebar Button */}
                    <button 
                        onClick={() => setShowRightSidebar(!showRightSidebar)}
                        className={`p-2 rounded-full transition-colors ${showRightSidebar ? 'bg-blue-50 text-primary' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Info size={24} />
                    </button>
                </div>
            </div>
            
            {/* Product Context Bar (Only if sidebar is hidden, to save space) */}
            {!showRightSidebar && (activeConversation.product_title || productData) && (
                <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                            {productData?.image ? (
                                <img src={productData.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <Package size={16} className="text-gray-400" />
                            )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs text-gray-500">Producto de interés:</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={activeConversation.product_title || productData?.title}>
                            {activeConversation.product_title || productData?.title}
                        </span>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-white scroll-smooth"
            >
               {messages.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                       <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                           <Image 
                             src={getOtherPartyImage(activeConversation) || ""} 
                             alt="" 
                             width={80} 
                             height={80} 
                             className="rounded-full w-full h-full object-cover opacity-50"
                           />
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-1">{getOtherPartyName(activeConversation)}</h3>
                       <p className="text-sm text-gray-500">Facebook • Tú son amigos en Facebook</p>
                       <span className="mt-4 text-xs text-gray-400">Inicio de la conversación</span>
                   </div>
               )}
               
               {messages.map((msg, idx) => {
                 const isMe = String(msg.sender_id) === String(user?.id);
                 const showAvatar = !isMe && (idx === messages.length - 1 || String(messages[idx + 1]?.sender_id) !== String(msg.sender_id));
                 const parsed = parseMessageContent(msg.content);
                 
                 return (
                   <div key={idx} className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start items-end gap-2'}`}>
                     
                     {!isMe && (
                        <div className="w-7 h-7 shrink-0 mb-1">
                            {showAvatar && (
                                <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden">
                                    {getOtherPartyImage(activeConversation) ? (
                                        <img src={getOtherPartyImage(activeConversation)!} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                                            {getOtherPartyName(activeConversation).charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                     )}

                     <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`px-4 py-2 text-[15px] leading-relaxed shadow-sm break-words
                            ${parsed.type === 'product_card' 
                                ? 'bg-transparent p-0 shadow-none' 
                                : isMe 
                                    ? 'bg-[#0084FF] text-white rounded-2xl rounded-tr-md' 
                                    : 'bg-[#E4E6EB] text-black rounded-2xl rounded-tl-md'
                            }`}
                        >
                          {/* 1. Attachment Handling */}
                          {msg.attachment_url && (
                             <div className="mb-2">
                                 {msg.message_type === 'image' || (msg.attachment_url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                     <div className="relative rounded-lg overflow-hidden mb-1">
                                         <img 
                                             src={getAbsoluteUrl(msg.attachment_url)} 
                                             alt="Adjunto" 
                                             className="max-w-full h-auto max-h-60 object-cover cursor-pointer hover:opacity-90"
                                             onClick={() => window.open(getAbsoluteUrl(msg.attachment_url), '_blank')}
                                         />
                                     </div>
                                 ) : (
                                     <a 
                                         href={getAbsoluteUrl(msg.attachment_url)} 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                         className={`flex items-center gap-3 p-3 rounded-lg border ${isMe ? 'bg-white/10' : 'bg-white/50'}`}
                                     >
                                         <FileText size={20} />
                                         <span className="text-sm underline">Ver Archivo</span>
                                     </a>
                                 )}
                             </div>
                          )}
                          
                          {/* 2. Product Card Rendering */}
                          {parsed.type === 'product_card' ? (
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm w-[280px]">
                                  <div className="relative h-40 bg-gray-100">
                                      {parsed.data.image ? (
                                          <img src={parsed.data.image} alt={parsed.data.title} className="w-full h-full object-cover" />
                                      ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                                              <Package size={40} />
                                          </div>
                                      )}
                                      <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                                          Producto
                                      </div>
                                  </div>
                                  <div className="p-3">
                                      <h4 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-1">
                                          {parsed.data.title}
                                      </h4>
                                      <div className="flex items-center justify-between mb-2">
                                          <span className="text-lg font-bold text-red-600">
                                              ${Number(parsed.data.price).toLocaleString()}
                                          </span>
                                          {parsed.data.min_order && (
                                              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                  MOQ: {parsed.data.min_order}
                                              </span>
                                          )}
                                      </div>
                                      <a 
                                        href={`/product/${parsed.data.product_id}`} 
                                        target="_blank"
                                        className="block w-full text-center py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                                      >
                                          Ver Detalles
                                      </a>
                                  </div>
                              </div>
                          ) : (
                              // 3. Normal Text
                              <p>{msg.content}</p>
                          )}
                        </div>
                     </div>
                   </div>
                 );
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Area */}
            <div className="p-3 bg-white border-t border-gray-200 flex items-end gap-2">
               {error && (
                   <div className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 shadow-md">
                       <span>{error}</span>
                       <button onClick={() => setError(null)}><X size={14} /></button>
                   </div>
               )}

               <div className="flex items-center gap-1 mb-2">
                   {/* Attachments */}
                   <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="p-2 text-primary hover:bg-gray-100 rounded-full transition-colors"
                   >
                       <ImageIcon size={20} />
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" />
               </div>

               <div className="flex-1 bg-[#F0F2F5] rounded-3xl px-4 py-2.5 focus-within:ring-1 focus-within:ring-gray-300 transition-all flex items-center">
                  <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Escribe un mensaje..."
                      className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none max-h-32 min-h-[24px] text-gray-900 placeholder-gray-500 leading-relaxed"
                      rows={1}
                      style={{ height: 'auto', minHeight: '24px' }}
                  />
                  <button className="ml-2 text-primary hover:text-blue-700">
                      <Smile size={20} />
                  </button>
               </div>
               
               {inputValue.trim() ? (
                   <button 
                      onClick={handleSendMessage}
                      disabled={sending}
                      className="p-3 text-primary hover:bg-blue-50 rounded-full transition-colors mb-0.5"
                   >
                      <Send size={24} className={sending ? "opacity-50" : ""} />
                   </button>
               ) : (
                   <button className="p-3 text-primary hover:bg-blue-50 rounded-full transition-colors mb-0.5">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                   </button>
               )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={48} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Bienvenido a Messenger</h3>
            <p className="text-gray-500">Selecciona un chat para comenzar</p>
          </div>
        )}
      </div>

      {/* Right Sidebar - Product Context & History */}
      {activeConversation && showRightSidebar && (
        <div className="w-[300px] border-l border-gray-200 bg-white flex flex-col overflow-y-auto z-10 hidden lg:flex">
            {/* 1. Profile / Header */}
            <div className="p-6 flex flex-col items-center border-b border-gray-100">
                <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden mb-3">
                     {getOtherPartyImage(activeConversation) ? (
                         <img src={getOtherPartyImage(activeConversation)!} alt="" className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">
                             {getOtherPartyName(activeConversation).charAt(0).toUpperCase()}
                         </div>
                     )}
                </div>
                <h3 className="font-bold text-lg text-gray-900 text-center">{getOtherPartyName(activeConversation)}</h3>
                <p className="text-sm text-gray-500">Usuario de SafeEasy</p>
            </div>

            {/* 2. Current Product Context */}
            {productData && (
                <div className="p-4 border-b border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contexto Actual</h4>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-white mb-2">
                             {productData.image ? (
                                 <img src={productData.image} alt={productData.title} className="w-full h-full object-cover" />
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center"><Package className="text-gray-300" /></div>
                             )}
                        </div>
                        <h5 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">{productData.title}</h5>
                        <div className="font-bold text-primary mb-2">${productData.price.toLocaleString()}</div>
                        
                        <button 
                            onClick={() => handleSendProduct(productData)}
                            disabled={sending}
                            className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Send size={14} />
                            Enviar Referencia
                        </button>
                    </div>
                </div>
            )}

            {/* 3. History / Suggestions (Mocked from LocalStorage) */}
            <div className="p-4">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Clock size={12} />
                     Vistos Recientemente
                 </h4>
                 {recentProducts.length > 0 ? (
                     <div className="space-y-3">
                         {recentProducts.slice(0, 5).map(prod => (
                             <div key={prod.id} className="flex gap-3 items-start group">
                                 <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                                     {prod.image && <img src={prod.image} alt="" className="w-full h-full object-cover" />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <h5 className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug mb-0.5">{prod.title}</h5>
                                     <div className="text-[10px] text-gray-500">${prod.price.toLocaleString()}</div>
                                     <button 
                                        onClick={() => handleSendProduct(prod)}
                                        className="text-[10px] text-primary hover:underline mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                         Enviar referencia
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <p className="text-xs text-gray-400 italic">No hay historial reciente disponible.</p>
                 )}
            </div>

            {/* 4. Actions */}
            <div className="mt-auto p-4 border-t border-gray-100">
                 {user?.role === 'client' && (
                     <button 
                        onClick={handlePaymentClick}
                        disabled={!productData?.supplier?.transfer_accepted}
                        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mb-2 ${
                             !productData?.supplier?.transfer_accepted
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-primary text-white hover:bg-blue-700'
                        }`}
                     >
                         <CreditCard size={16} />
                         Iniciar Pago
                     </button>
                 )}
            </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && productData?.supplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gray-50 p-4 border-b flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <CreditCard className="text-green-600" size={20} />
                        Datos de Transferencia
                    </h3>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm text-blue-800 mb-2 font-medium">Instrucciones:</p>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Realiza la transferencia a la siguiente cuenta y envía el comprobante por este chat.
                            Tu orden ha sido creada con ID: <span className="font-bold">{createdOrderId}</span>.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Banco</label>
                            <p className="text-lg font-medium text-gray-900">{productData.supplier.transfer_bank || "No especificado"}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Beneficiario</label>
                            <p className="text-lg font-medium text-gray-900">{productData.supplier.transfer_name || productData.supplier.name || "No especificado"}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">CLABE / Cuenta</label>
                            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-1">
                                <code className="text-lg font-mono text-primary font-bold flex-1">
                                    {productData.supplier.transfer_clabe || "No especificada"}
                                </code>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
