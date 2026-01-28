"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { Conversation, Message } from "@/types/chat";
import { Send, Image as ImageIcon, X, MoreVertical, Phone, Paperclip, Loader2, CreditCard } from "lucide-react";
import Image from "next/image";

import { fetchWithAuth } from "@/lib/api";

interface ChatWindowProps {
  productId: string | number;
  supplierId: number;
  supplierName?: string;
  isOwner?: boolean;
  productData: {
    title: string;
    price: number;
    image: string;
    minOrder?: number;
  };
  supplierTransferData?: {
    transfer_clabe?: string | null;
    transfer_bank?: string | null;
    transfer_name?: string | null;
    transfer_accepted?: boolean;
  };
  onClose: () => void;
  isOpen: boolean;
}

export default function ChatWindow({ productId, supplierId, supplierName, isOwner, productData, supplierTransferData, onClose, isOpen }: ChatWindowProps) {
  const { user } = useAuthStore();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProductCard, setShowProductCard] = useState(true);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const handlePaymentClick = async () => {
    if (!activeConversation) return;
    
    setIsCreatingOrder(true);
    try {
        const payload = {
            supplier_id: supplierId,
            product_id: productId,
            conversation_id: activeConversation.id,
            status: "pending"
        };
        
        const res = await fetchWithAuth('/api/orders/', {
             method: 'POST',
             body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            setIsPaymentModalOpen(true);
        } else {
            console.error("Failed to create order");
            setError("No se pudo iniciar el proceso de pago. Intenta de nuevo.");
        }
    } catch (error) {
        console.error("Error creating order", error);
        setError("Error al procesar la solicitud de pago.");
    } finally {
        setIsCreatingOrder(false);
    }
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine if current user is the supplier (Vendor Mode)
  // Ensure strict string comparison to avoid type mismatch
  // Use state to allow auto-detection to override mismatched IDs
  const [isVendorMode, setIsVendorMode] = useState(() => {
    // If explicitly told it's owner, or IDs match
    if (isOwner) return true;
    return !!(user?.id && supplierId && String(user.id) === String(supplierId));
  });

  // Sync isVendorMode with props if they change and match strictly
  useEffect(() => {
    if (isOwner || (user?.id && supplierId && String(user.id) === String(supplierId))) {
        setIsVendorMode(true);
    }
  }, [user, supplierId, isOwner]);
  
  // Debug logs
  useEffect(() => {
    if (isOpen) {
        console.log("[ChatWindow] Debug IDs:", { 
            currentUserId: user?.id, 
            productSupplierId: supplierId, 
            isVendorMode,
            productId,
            activeConversationId: activeConversation?.id
        });
    }
  }, [isOpen, user, supplierId, isVendorMode, productId, activeConversation]);

  // Initialize WebSocket with active conversation
  const { status, messages: wsMessages, sendMessage: wsSendMessage, lastMessage } = useChatWebSocket(activeConversation?.id, isOpen);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Helper to load messages
  const loadMessages = async (conversationId: number | string) => {
    try {
      const history = await chatService.getMessages(conversationId);
      setMessages(history);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // 1. Initialize Chat (Vendor vs Buyer Logic)
  useEffect(() => {
    if (isOpen && user) {
      const initChat = async () => {
        setLoading(true);
        setError(null);
        try {
          // Check explicit ID match
          // FORCE Vendor Mode if isOwner prop is true, regardless of ID match (trust the parent)
          // We remove the aggressive check for role === 'supplier' to prevent buyers (who are also suppliers) from being forced into vendor mode.
          // Only Admin remains as a privileged role that might default to Vendor, but even that is risky if they want to buy.
          // Let's rely primarily on IDs and Conversations.
          let currentIsVendor = isOwner || String(user.id) === String(supplierId);
          
          // Auto-detect Vendor Mode if ID match fails but user is supplier/admin
          // This handles cases where supplierId is a Profile ID vs User ID
          // We keep the check here to ALLOW auto-detection, but not force it yet.
          if (!currentIsVendor && (user.role === 'supplier' || user.role === 'admin' || user.role === 'provider')) {
             try {
                const all = await chatService.getConversations();
                // Helper to get product ID safely (redefined here for scope)
                const getProductId = (c: Conversation) => c.product_id || (c as any).product?.id;
                
                const productConvos = all.filter(c => 
                    getProductId(c) && String(getProductId(c)) === String(productId)
                );
                
                // If we find conversations for this product where we are the SUPPLIER,
                // then we are definitely the vendor.
                // UPDATED: Check 'my_role' if available from backend (chat.md compliance)
                const amISupplier = productConvos.some(c => 
                    c.my_role === 'supplier' || 
                    String(c.supplier_id) === String(user.id)
                );
                
                if (amISupplier) {
                    console.log("[ChatWindow] Auto-detected Vendor Mode (Found conversation where my_role=supplier or ID match)");
                    currentIsVendor = true;
                    setIsVendorMode(true);
                    // We can reuse the fetched conversations
                    setConversations(productConvos);
                    
                    if (productConvos.length === 0) {
                         setActiveConversation(null);
                    } else if (productConvos.length === 1) {
                         setActiveConversation(productConvos[0]);
                         await loadMessages(productConvos[0].id);
                    }
                }
             } catch (err) {
                 console.warn("[ChatWindow] Vendor auto-detection failed:", err);
             }
          }

          // Helper to get product ID safely
          const getProductId = (c: Conversation) => c.product_id || (c as any).product?.id;

          if (currentIsVendor) {
            // VENDOR MODE: If we didn't already fetch above, fetch now
            setIsVendorMode(true); // Ensure state is synced
            if (conversations.length === 0) { 
                const allConversations = await chatService.getConversations();
                
                console.log("[ChatWindow] All fetched conversations (Vendor Mode):", allConversations);
                
                // Relaxed filtering:
                // 1. Strict match on product_id
                // 2. If product_id is missing in conversation, check if we are the supplier (trusting the context)
                //    AND if the product_title matches (if available) or simply show it if we are on that supplier page.
                const productConversations = allConversations.filter(c => {
                    const cProdId = getProductId(c);
                    // Case 1: ID Match
                    if (cProdId && String(cProdId) === String(productId)) return true;
                    
                    // Case 2: ID Missing but we are the supplier in this conversation
                    // We only want to show relevant chats. If product_id is missing, we might show chats for other products
                    // if we are not careful. But showing SOME chats is better than NONE.
                    // Let's check if the product title matches roughly if ID is missing.
                    if (!cProdId && c.my_role === 'supplier') {
                         if (productData?.title && c.product_title && c.product_title === productData.title) {
                             return true;
                         }
                         // Fallback: If no product info at all in conversation, but we are the supplier, show it?
                         // Maybe risky. Let's stick to title match or ID match for now.
                         // But wait, the user provided JSON example has product_title.
                         return false; 
                    }
                    return false;
                });
                
                // Fallback: If strict filtering returns empty, let's try a broader search for this supplier
                // This helps if the backend isn't sending product_id/title correctly but we know we are the supplier.
                let finalConversations = productConversations;
                if (productConversations.length === 0) {
                     console.log("[ChatWindow] Strict filter returned 0. Trying broader filter by Supplier Role...");
                     const broader = allConversations.filter(c => 
                        c.my_role === 'supplier' || String(c.supplier_id) === String(user.id) || 
                        (String(user.id) === String(supplierId) && !c.product_id) // Match if I am the supplier of this page and convo has no product attached
                     );
                     
                     // Filter by title if possible to reduce noise
                     if (productData?.title) {
                         const titleMatches = broader.filter(c => c.product_title === productData.title);
                         if (titleMatches.length > 0) {
                             finalConversations = titleMatches;
                         } else if (broader.length > 0) {
                             // If no title match, show all broader matches (better than empty)
                             console.log("[ChatWindow] No title match found. Showing all supplier conversations as fallback.");
                             finalConversations = broader;
                         }
                     } else {
                         finalConversations = broader;
                     }
                }

                // Sort by last update/created desc to show most recent first
                finalConversations.sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                    return dateB - dateA;
                });

                setConversations(finalConversations);

                // If we have conversations but none active, or if we want to ensure we see new ones
                // For Vendor, we usually show list if multiple.
                if (finalConversations.length === 0) {
                     setActiveConversation(null);
                } else if (finalConversations.length === 1) {
                     // Only auto-select if we don't have one active or if it's the only one
                     if (!activeConversation) {
                        setActiveConversation(finalConversations[0]);
                        await loadMessages(finalConversations[0].id);
                     }
                }
            }
          } else {
            // BUYER MODE
            setIsVendorMode(false);
            
            const all = await chatService.getConversations();
            const existingCandidates = all.filter(c => 
                getProductId(c) && String(getProductId(c)) === String(productId) && 
                String(c.supplier_id) === String(supplierId)
            );
            
            existingCandidates.sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                return dateB - dateA;
            });

            const existing = existingCandidates[0];
            
            if (existing) {
                console.log(`[ChatWindow] Found ${existingCandidates.length} existing conversations. Using most recent: ${existing.id}`);
                setActiveConversation(existing);
                await loadMessages(existing.id);
                // Also update conversations list for the sidebar (even if hidden for single chat, good for state)
                setConversations([existing]);
            } else {
                const conversation = await chatService.createConversation({
                  supplier_id: supplierId,
                  product_id: productId
                });
                setActiveConversation(conversation);
                await loadMessages(conversation.id);
                setConversations([conversation]);
            }
          }
        } catch (error) {
          console.error("Failed to initialize chat:", error);
          const errorMessage = error instanceof Error ? error.message : "Error desconocido";
          setError(`No se pudo iniciar el chat: ${errorMessage}`);
        } finally {
          setLoading(false);
        }
      };
      
      initChat();
    }
  }, [isOpen, productId, supplierId, user]); // Removed isVendor from dep array to avoid loops, relying on calculated currentIsVendor

  // 2. Sync real-time messages
  useEffect(() => {
    if (lastMessage && activeConversation) {
       console.log("[ChatWindow] New lastMessage received:", lastMessage);
       if (String(lastMessage.conversation_id) === String(activeConversation.id)) {
           // Check if message is already in list to avoid duplicates (common in optimistic UI + WS echo)
           setMessages(prev => {
              // If we have an optimistic message (large numeric ID usually, or just check content/time match)
              // Ideally, backend returns a temporary ID we sent, but here we just check if we have a duplicate by real ID.
              // Or if we want to replace the optimistic one.
              
              if (prev.some(m => m.id === lastMessage.id)) {
                  console.log("[ChatWindow] Duplicate message ignored:", lastMessage.id);
                  return prev;
              }
              
              // Simple dedupe strategy: If we have a message with same content sent recently (last 2 seconds) by me, 
              // and it has a temp ID (e.g. timestamp > 1000000000000 and different from real ID format if any), replace it?
              // For now, just append. If user sees duplicate, we can refine.
              // Actually, let's filter out optimistic messages that match the content/sender if we get a real one.
              
              console.log("[ChatWindow] Appending new message:", lastMessage);
              return [...prev, lastMessage];
           });
           scrollToBottom();
       } else {
           console.warn("[ChatWindow] Message conversation mismatch:", {
               msgConvId: lastMessage.conversation_id,
               activeConvId: activeConversation.id
           });
       }
    }
  }, [lastMessage, activeConversation]);

  // 3. Polling Fallback (Every 10 seconds)
  // Ensures that if WebSocket fails, messages are still synced automatically.
  useEffect(() => {
    if (!activeConversation || !isOpen) return;

    const pollInterval = setInterval(() => {
        // Only poll if we are not already loading (though loadMessages handles its own state usually, we want to be silent)
        // We use a silent fetch here to avoid flickering loading states if we were to use the main loading state.
        // But loadMessages sets 'setLoading(true)' which causes UI flicker.
        // We should create a silentLoadMessages or modify loadMessages.
        
        chatService.getMessages(activeConversation.id).then(history => {
             // Only update if length changed or last message ID changed to avoid re-renders?
             // React state updates are cheap if value is same (ref check), but array is new ref.
             // Let's just update. The list component handles keys.
             setMessages(prev => {
                 if (prev.length === history.length && prev[prev.length-1]?.id === history[history.length-1]?.id) {
                     return prev;
                 }
                 return history;
             });
        }).catch(err => console.warn("[ChatWindow] Polling failed:", err));
        
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [activeConversation, isOpen]);

  // 4. Poll for CONVERSATIONS list (Vendor Mode only)
  // This ensures the vendor sees new clients without refreshing
  useEffect(() => {
    if (!isOpen || !isVendorMode) return;
    
    const pollConvos = setInterval(async () => {
        try {
            const allConversations = await chatService.getConversations();
            // Helper to get product ID safely
            const getProductId = (c: Conversation) => c.product_id || (c as any).product?.id;
            
            // Relaxed filtering (Same as initChat)
            const productConversations = allConversations.filter(c => {
                const cProdId = getProductId(c);
                // Case 1: ID Match
                if (cProdId && String(cProdId) === String(productId)) return true;
                
                // Case 2: ID Missing but we are the supplier
                if (!cProdId && c.my_role === 'supplier') {
                     if (productData?.title && c.product_title && c.product_title === productData.title) {
                         return true;
                     }
                     return false; 
                }
                return false;
            });
            
            // Fallback: If strict filtering returns empty, try broader
            let finalConversations = productConversations;
            if (productConversations.length === 0) {
                 const broader = allConversations.filter(c => 
                    c.my_role === 'supplier' || (user?.id && String(c.supplier_id) === String(user.id)) || 
                    (user?.id && String(user.id) === String(supplierId) && !c.product_id)
                 );
                 
                 if (productData?.title) {
                     const titleMatches = broader.filter(c => c.product_title === productData.title);
                     if (titleMatches.length > 0) {
                         finalConversations = titleMatches;
                     } else if (broader.length > 0) {
                         finalConversations = broader;
                     }
                 } else {
                     finalConversations = broader;
                 }
            }
            
            finalConversations.sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                return dateB - dateA;
            });

            // Update list silently
            setConversations(prev => {
                // Check if different to avoid re-renders?
                // For now just update, React handles array ref diffs.
                // Or better, check lengths or IDs.
                if (prev.length === finalConversations.length && prev[0]?.id === finalConversations[0]?.id) {
                    return prev;
                }
                console.log("[ChatWindow] Updating vendor conversation list from poll");
                return finalConversations;
            });
            
        } catch (err) {
            console.warn("[ChatWindow] Failed to poll conversations:", err);
        }
    }, 5000);
    
    return () => clearInterval(pollConvos);
  }, [isOpen, isVendorMode, productId]);

  // Scroll on initial load
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeConversation || !user) return;

    const messageContent = inputValue;
    const tempId = Date.now(); // Temporary ID for optimistic update
    
    // Create optimistic message
    const optimisticMessage: Message = {
        id: tempId,
        conversation_id: activeConversation.id,
        sender_id: Number(user.id),
        content: messageContent,
        created_at: new Date().toISOString(),
        is_read: false,
        message_type: 'text'
    };

    setInputValue(""); // Clear input immediately
    
    // Add optimistic message to UI
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 50);

    // Attempt 1: WebSocket (Preferred and ONLY supported method as per chat.md)
    if (status === 'connected') {
        try {
            wsSendMessage(messageContent, activeConversation.id);
            // We rely on WS echo to confirm message.
            return;
        } catch (wsErr) {
            console.error("WebSocket send failed", wsErr);
            setError("Error de conexión. Intenta recargar la página.");
        }
    } else {
        console.warn("WebSocket is not connected. Status:", status);
        setError("Chat desconectado. Espera un momento o recarga.");
    }

    // Restore input and remove optimistic message on failure
    setInputValue(messageContent);
    setMessages(prev => prev.filter(m => m.id !== tempId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to safely format date
  const formatDate = (dateString?: string) => {
    try {
        if (!dateString) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (e) {
        return "";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-100">
        
        {/* Left: Conversations List (Visible for Vendor or if multiple chats exist) */}
        {(isVendorMode || conversations.length > 0) && (
          <div className="w-72 border-r bg-white flex flex-col shrink-0 h-full overflow-hidden">
              <div className="p-4 border-b bg-gray-50 shrink-0 flex items-center justify-between">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                      {isVendorMode ? 'Clientes' : 'Proveedores'}
                  </h4>
                  <button 
                    onClick={() => {
                        // Re-fetch conversations
                        setLoading(true);
                        chatService.getConversations().then(all => {
                            if (isVendorMode) {
                                const productConversations = all.filter(c => 
                                    c.product_id && String(c.product_id) === String(productId)
                                );
                                setConversations(productConversations);
                            } else {
                                // For buyer, refresh list and ensure we have the right one active
                                const productConversations = all.filter(c => 
                                    c.product_id && String(c.product_id) === String(productId)
                                );
                                setConversations(productConversations);
                                
                                if (activeConversation) {
                                    loadMessages(activeConversation.id);
                                }
                            }
                        }).finally(() => setLoading(false));
                    }}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                    title="Actualizar lista"
                  >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                      </svg>
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                  {conversations.length === 0 ? (
                      <div className="flex flex-col">
                          {/* Admin Warning for Missing Chats */}
                          {isVendorMode && String(user?.id) !== String(supplierId) && (
                            <div className="mx-4 mt-4 p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md text-left">
                                <p className="font-bold mb-1">⚠️ Aviso de Administrador</p>
                                <p>Estás logueado como ID {user?.id} ({user?.role}), pero este producto pertenece al Proveedor ID {supplierId}.</p>
                                <p className="mt-2 text-[10px] leading-tight text-amber-800">
                                    El sistema de chat es privado entre participantes. A menos que tu usuario sea agregado explícitamente a la conversación, 
                                    no verás los chats de este proveedor aquí.
                                </p>
                            </div>
                          )}
                          <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                              <span>📭</span>
                              <span>No hay chats activos.</span>
                          </div>
                      </div>
                  ) : (
                      conversations.map(conv => (
                          <button 
                            key={conv.id} 
                            onClick={() => { 
                                setActiveConversation(conv); 
                                loadMessages(conv.id); 
                            }}
                            className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors flex items-center gap-3 ${activeConversation?.id === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                          >
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold shrink-0">
                                  {/* Avatar placeholder */}
                            {(conv.other_party_name || (isVendorMode ? (conv.user_name || `C${conv.user_id}`) : (conv.supplier_name || supplierName || 'P')) || '?').charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-gray-800 truncate">
                                {conv.other_party_name || (isVendorMode ? (conv.user_name || (conv.user ? `${conv.user.first_name || ''} ${conv.user.last_name || ''}`.trim() : `Cliente #${conv.user_id}`)) : (conv.supplier_name || supplierName || 'Proveedor'))}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                      {conv.last_message || 'Ver conversación...'}
                                  </div>
                              </div>
                          </button>
                      ))
                  )}
              </div>
          </div>
        )}

        {/* Center: Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0 h-full overflow-hidden">
          {/* Header */}
          <div className="bg-white p-4 border-b flex items-center justify-between shadow-sm z-10 shrink-0 h-16 box-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {productData.title.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800 truncate flex flex-col">
                    <span>
                    {activeConversation 
                        ? (activeConversation.other_party_name || 
                           (isVendorMode 
                                ? (activeConversation.user_name || activeConversation.buyer_name || (activeConversation.user ? `${activeConversation.user.first_name || ''} ${activeConversation.user.last_name || ''}`.trim() : `Cliente #${activeConversation.user_id}`)) 
                                : (activeConversation.supplier_name || supplierName || 'Proveedor')))
                        : 'Chat del Producto'}
                    </span>
                    {/* Debug Info Overlay - REMOVE IN PRODUCTION */}
                    {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-0 left-0 right-0 bg-black/80 text-white text-[10px] p-1 z-50 flex justify-between px-2">
            <span>
                    Mode: <span className={isVendorMode ? "text-green-400 font-bold" : "text-blue-400 font-bold"}>
                        {isVendorMode ? "VENDOR" : "CLIENT"}
                    </span>
                    {" | "}
                    Me: {user?.id} ({user?.role}) | Supp: {supplierId} | Owner: {isOwner ? "Yes" : "No"}
                </span>
                <span>
                    ConvID: <span className="text-yellow-400 font-mono">{activeConversation ? activeConversation.id : 'None'}</span>
                    {" | "}
                    Status: <span className={status === 'connected' ? "text-green-400" : "text-red-400"}>{status}</span>
                    <button 
                        onClick={() => {
                            setIsVendorMode(!isVendorMode);
                            // Refresh logic if needed
                        }}
                        className="ml-2 bg-gray-700 hover:bg-gray-600 text-white px-1 rounded cursor-pointer"
                    >
                        Switch Mode
                    </button>
                    <button
                        onClick={() => {
                            chatService.getConversations().then(res => {
                                console.log("[DEBUG] All Conversations from Backend:", res);
                                alert(`Fetched ${res.length} conversations. Check Console for details.`);
                            });
                        }}
                        className="ml-2 bg-blue-700 hover:bg-blue-600 text-white px-1 rounded cursor-pointer"
                    >
                        Log All
                    </button>
                </span>
        </div>
      )}
                </h3>
                {activeConversation && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    {status === 'connected' ? 'En línea' : 'Desconectado'}
                    </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
               <button 
                  onClick={() => {
                      if (activeConversation) {
                          loadMessages(activeConversation.id);
                      }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-primary"
                  title="Actualizar mensajes"
               >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                  </svg>
               </button>
               <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-500" />
               </button>
            </div>
          </div>

          {/* Content Area (Messages or Empty State) */}
          {!activeConversation && conversations.length > 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                 <p className="text-lg font-medium text-gray-500">Selecciona un cliente</p>
                 <p className="text-sm">Para ver los mensajes y responder</p>
             </div>
          ) : (
             <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Cargando historial...
                    </div>
                    ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2">
                        <p>{error}</p>
                    </div>
                    ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        {isVendorMode ? (
                            <>
                                <span className="text-4xl">📨</span>
                                <span className="font-medium">Esperando mensajes del cliente...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-4xl">💬</span>
                                <span className="font-medium">Inicia la conversación.</span>
                            </>
                        )}
                        <button 
                            onClick={() => activeConversation && loadMessages(activeConversation.id)} 
                            className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-primary hover:bg-gray-50 shadow-sm transition-all flex items-center gap-2"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                            </svg>
                            Actualizar mensajes
                        </button>
                    </div>
                    ) : (
                    messages.map((msg, idx) => {
                        // Loose comparison for ID safety
                        const isMe = String(user?.id) === String(msg.sender_id);
                        
                        return (
                        <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* Sender Name Label */}
                            {!isMe && (
                                <span className="text-[10px] text-gray-400 mb-1 ml-1">
                                    {activeConversation?.other_party_name || 
                                     (isVendorMode 
                                        ? (activeConversation?.user_name || activeConversation?.buyer_name || 'Cliente') 
                                        : (activeConversation?.supplier_name || supplierName || 'Proveedor'))}
                                </span>
                            )}
                            
                            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 px-4 shadow-sm ${
                            isMe 
                                ? 'bg-primary text-white rounded-tr-none shadow-primary/20' 
                                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}>
                            {msg.message_type === 'image' ? (
                                <div className="relative w-full h-48 mb-2 rounded-lg overflow-hidden">
                                    <Image 
                                        src={msg.content} 
                                        alt="Shared image" 
                                        fill 
                                        className="object-cover"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                            )}
                            <span className={`text-[10px] mt-1 block text-right ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
                                {formatDate(msg.created_at)}
                            </span>
                            </div>
                        </div>
                        );
                    })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Product Info Mini Card (Visible above input) */}
                {showProductCard && (
                    <div className="bg-white px-4 py-3 border-t flex items-center gap-3 shrink-0 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                        <div className="w-12 h-12 relative rounded-md overflow-hidden border bg-gray-100 shrink-0">
                            {productData.image ? (
                                <Image 
                                    src={productData.image} 
                                    alt={productData.title}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <ImageIcon size={20} />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">Product</span>
                                <h4 className="font-medium text-gray-800 text-sm truncate max-w-[300px]" title={productData.title}>
                                    {productData.title}
                                </h4>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="font-bold text-gray-900 text-sm">${productData.price.toLocaleString()}</span>
                                <span className="text-gray-300">|</span>
                                <span>Min. Order: {productData.minOrder || 1} Pieces</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowProductCard(false)} 
                            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-full transition-colors absolute top-2 right-2"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-white p-4 border-t shrink-0">
                    <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border focus-within:border-primary focus-within:bg-white transition-all shadow-sm">
                    {/* Pay Button - Buyer Mode Only */}
                    {!isVendorMode && supplierTransferData?.transfer_accepted && (
                        <button 
                            onClick={handlePaymentClick}
                            disabled={isCreatingOrder || !activeConversation}
                            className="p-2 mr-1 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 transition-colors flex items-center gap-1 font-medium text-xs disabled:opacity-50"
                            title="Realizar Pago"
                        >
                             {isCreatingOrder ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                             <span className="hidden sm:inline">Pago</span>
                        </button>
                    )}
                    <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                        <Paperclip size={20} />
                    </button>
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        disabled={!activeConversation}
                        placeholder={!activeConversation ? "Selecciona una conversación..." : "Escribe tu mensaje..."}
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none resize-none max-h-32 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!inputValue.trim() || !activeConversation}
                        className="p-2 bg-primary text-white rounded-lg shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={18} />
                    </button>
                    </div>
                </div>
             </>
          )}
        </div>

      </div>
      
      {/* Payment Modal */}
      {isPaymentModalOpen && supplierTransferData && (
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
                    {/* Amount */}
                    <div className="text-center">
                        <p className="text-sm text-gray-500 mb-1">Monto Total a Pagar</p>
                        <p className="text-3xl font-bold text-gray-900">${productData.price.toLocaleString()}</p>
                    </div>
                    
                    {/* Bank Details */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Banco</p>
                            <p className="font-medium text-gray-800">{supplierTransferData.transfer_bank || 'No especificado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Beneficiario</p>
                            <p className="font-medium text-gray-800">{supplierTransferData.transfer_name || 'No especificado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CLABE Interbancaria</p>
                            <div className="flex items-center gap-2">
                                <p className="font-mono font-medium text-gray-800 text-lg tracking-wide select-all">
                                    {supplierTransferData.transfer_clabe || 'No especificado'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Instructions */}
                    <div className="text-xs text-gray-500 bg-blue-50 text-blue-700 p-3 rounded-lg">
                        <p className="font-bold mb-1">Instrucciones:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Realiza la transferencia por el monto exacto.</li>
                            <li>Usa el ID de Orden como concepto de pago (opcional).</li>
                            <li>Envía el comprobante en este chat para confirmar.</li>
                        </ul>
                    </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button 
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-sm"
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

