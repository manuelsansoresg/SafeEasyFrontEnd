"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { chatService } from "@/services/chatService";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { Conversation, Message } from "@/types/chat";
import { Send, Image as ImageIcon, X, MoreVertical, Phone, Paperclip, Loader2, CreditCard, Smile, PlusCircle, Star } from "lucide-react";
import Image from "next/image";
import StarRating from "../StarRating";

import { fetchWithAuth } from "@/lib/api";

interface ChatWindowProps {
  productId: string | number | null;
  supplierId: number;
  supplierName?: string;
  supplierSlug?: string;
  isOwner?: boolean;
  productData: {
    title: string;
    price: number;
    image: string;
    minOrder?: number;
    slug?: string;
  };
  supplierTransferData?: {
    transfer_clabe?: string | null;
    transfer_bank?: string | null;
    transfer_name?: string | null;
    transfer_accepted?: boolean;
  };
  onClose: () => void;
  onMinimize?: () => void;
  isOpen: boolean;
  mode?: 'modal' | 'docked';
}

export default function ChatWindow({ productId, supplierId, supplierName, supplierSlug, isOwner, productData, supplierTransferData, onClose, onMinimize, isOpen, mode = 'modal' }: ChatWindowProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProductCard, setShowProductCard] = useState(true);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | number | null>(null);
  const [isCreatingOrderAsSupplier, setIsCreatingOrderAsSupplier] = useState(false);
  const getSupplierOrdersStorageKey = (uid?: number | string) =>
    `safeeasy:supplier_orders_by_product_v1:${uid ?? "anon"}`;

  const readSupplierOrdersFromStorage = (uid?: number | string) => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(getSupplierOrdersStorageKey(uid));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed as Record<string, string | number>;
    } catch {
      return {};
    }
  };

  const writeSupplierOrdersToStorage = (
    uid: number | string | undefined,
    map: Record<string, string | number>
  ) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getSupplierOrdersStorageKey(uid), JSON.stringify(map));
    } catch {
    }
  };

  const [supplierOrderByProductId, setSupplierOrderByProductId] = useState<Record<string, string | number>>({});
  const checkedOrderProductsRef = useRef<Set<string>>(new Set());

  // Rating State
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  // Helper to get absolute URL
  const getAbsoluteUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http') || url.startsWith('blob:')) return url;
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
      return `${apiBase.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
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

  // Track if we sent the initial context message for this session
  const contextSentRef = useRef(false);

  // Reset ref when closed or productId changes
  useEffect(() => {
    if (!isOpen) {
        contextSentRef.current = false;
    }
  }, [isOpen]);

  // Helper to get consistent chat name (avoiding self-name)
  const getChatName = (conv: Conversation | null) => {
      if (!conv) return supplierName || 'Chat';
      if (!user) return conv.user_name || conv.buyer_name || 'Usuario';

      const myId = String(user.id);
      const myName = (user.name || '').trim();
      
      // 1. Vendor Mode (I am Supplier)
      if (isVendorMode) {
           // Try user object first
           if (conv.user) {
               const convUserId = String(conv.user.id);
               if (convUserId !== myId) {
                   const name = (conv.user.name || `${conv.user.first_name || ''} ${conv.user.last_name || ''}`.trim());
                   if (name && name.toLowerCase() !== myName.toLowerCase()) return name;
               }
           }
           
           // Try flat fields, avoiding my name
           if (conv.buyer_name && conv.buyer_name.trim().toLowerCase() !== myName.toLowerCase()) return conv.buyer_name;
           
           if (conv.user_name && conv.user_name.trim().toLowerCase() !== myName.toLowerCase()) return conv.user_name;
           
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
           
           return `Cliente #${conv.user_id || conv.buyer_id}`;
      }
      
      // 2. Client Mode (I am Client)
      return conv.supplier_name || conv.other_party_name || supplierName || 'Proveedor';
  };

  useEffect(() => {
    contextSentRef.current = false;
  }, [productId]);

  // Auto-initiate chat removed. Logic moved to onClick of context bar.
  /*
  useEffect(() => {
     // ... logic moved ...
  }, []);
  */
  
  // Debug logs
  useEffect(() => {
    if (isOpen) {
        // console.log("[ChatWindow] Debug IDs:", { 
        //     currentUserId: user?.id, 
        //     productSupplierId: supplierId, 
        //     isVendorMode,
        //     productId,
        //     activeConversationId: activeConversation?.id
        // });
    }
  }, [isOpen, user, supplierId, isVendorMode, productId, activeConversation]);

  useEffect(() => {
    if (!user?.id) {
      setSupplierOrderByProductId({});
      return;
    }
    setSupplierOrderByProductId(readSupplierOrdersFromStorage(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (user) return;
    setIsPaymentModalOpen(false);
    setError(null);
    setMessages([]);
    setConversations([]);
    setActiveConversation(null);
    setInputValue("");
    setSelectedFile(null);
    setCreatedOrderId(null);
    setIsCreatingOrder(false);
    setIsCreatingOrderAsSupplier(false);
    setSupplierOrderByProductId({});
    onClose?.();
  }, [isOpen, user, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isVendorMode) return;
    if (!user?.id) return;

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      );

    const productUuidCandidates: string[] = [];
    if (productId && isUuid(String(productId))) productUuidCandidates.push(String(productId));
    for (const m of messages) {
      const pid = (m as any).product_id || (m as any).product?.id;
      if (pid && isUuid(String(pid))) productUuidCandidates.push(String(pid));
    }
    const uniqProductIds = Array.from(new Set(productUuidCandidates));
    if (uniqProductIds.length === 0) return;

    const supplierIdCandidate =
      Number((messages.find((m) => Number((m as any).supplier_id) > 0) as any)?.supplier_id) ||
      Number((activeConversation as any)?.supplier_id) ||
      Number(supplierId);

    if (!supplierIdCandidate || !Number.isFinite(supplierIdCandidate)) return;

    const checkOne = async (pid: string) => {
      if (supplierOrderByProductId[pid]) return;
      if (checkedOrderProductsRef.current.has(pid)) return;
      checkedOrderProductsRef.current.add(pid);

      const params = new URLSearchParams();
      params.set("skip", "0");
      params.set("limit", "1");
      params.set("supplier_id", String(supplierIdCandidate));
      params.set("product_id", pid);

      const res = await fetchWithAuth(`/api/orders?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const items = Array.isArray(data) ? data : (data as any)?.items || (data as any)?.results || [];
      if (!Array.isArray(items) || items.length === 0) return;

      const found = items[0];
      const orderId = found?.id || found?.order_id || true;
      setSupplierOrderByProductId((prev) => {
        const next = { ...prev, [pid]: orderId };
        writeSupplierOrdersToStorage(user.id, next);
        return next;
      });
    };

    Promise.allSettled(uniqProductIds.map((pid) => checkOne(pid)));
  }, [
    isOpen,
    isVendorMode,
    user?.id,
    productId,
    messages,
    activeConversation,
    supplierId,
    supplierOrderByProductId,
  ]);

  // Initialize WebSocket with active conversation
  const [chatEnabled, setChatEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("safeeasy:chat_enabled");
    return stored === "0" ? false : true;
  });

  const { status, messages: wsMessages, sendMessage: wsSendMessage, lastMessage, error: wsError, url: wsUrl } = useChatWebSocket(
    activeConversation?.id,
    isOpen && chatEnabled
  );

  // Sync WebSocket error to local error state (solo errores reales, no desconexiones normales)
  useEffect(() => {
    if (wsError && status === 'error') {
        setError(wsError);
    }
  }, [wsError, status]);

  // Send pending messages when WebSocket connects
  useEffect(() => {
    if (status === 'connected' && pendingMessages.length > 0 && activeConversation && !String(activeConversation.id).startsWith('temp-')) {
        // console.log("[ChatWindow] Sending pending messages via WebSocket", pendingMessages);
        
        // Send all pending messages
        pendingMessages.forEach(msg => {
            wsSendMessage(msg, activeConversation.id);
        });
        
        setPendingMessages([]);
        // Clear any previous connection error
        setError(null);
    }
  }, [status, pendingMessages, activeConversation, wsSendMessage]);

  // Clear error when status becomes connected
  useEffect(() => {
    if (status === 'connected') {
        setError(null);
    }
  }, [status]);

  const [localTransferData, setLocalTransferData] = useState(supplierTransferData);

  useEffect(() => {
    setLocalTransferData(supplierTransferData);
  }, [supplierTransferData]);

  const [canPay, setCanPay] = useState(!!supplierTransferData?.transfer_accepted);
  const [productPrice, setProductPrice] = useState(productData.price);
  const [productSlug, setProductSlug] = useState<string | undefined>(productData.slug);

  useEffect(() => {
    setProductPrice(productData.price);
    setProductSlug(productData.slug);
  }, [productData.price, productData.slug]);

  // Fetch extra supplier details if needed (for payment button)
  const fetchSupplierDetails = async () => {
    // Only fetch if we are missing key transfer details
    const hasDetails = localTransferData?.transfer_clabe || localTransferData?.transfer_bank;
    if (localTransferData?.transfer_accepted && hasDetails) return;
    
    // 1. Try fetching by SLUG first if available (Most reliable for transfer data)
    if (supplierSlug) {
        try {
            // console.log(`[ChatWindow] Fetching supplier details using slug: ${supplierSlug}`);
            // Ensure trailing slash for backend compatibility
            const slugRes = await fetchWithAuth(`/api/suppliers/${supplierSlug}/`);
            if (slugRes.ok) {
                const slugData = await slugRes.json();
                // console.log("[ChatWindow] Resolved supplier from slug:", slugData);
                
                if (slugData.transfer_accepted) {
                    setLocalTransferData({
                        transfer_accepted: true,
                        transfer_bank: slugData.transfer_bank,
                        transfer_clabe: slugData.transfer_clabe,
                        transfer_name: slugData.transfer_name
                    });
                    setCanPay(true);
                    return; 
                }
            } else {
                 // console.warn(`[ChatWindow] Failed to fetch supplier by slug (${slugRes.status}). trying without slash...`);
                 // Retry without slash just in case
                 const retryRes = await fetchWithAuth(`/api/suppliers/${supplierSlug}`);
                 if (retryRes.ok) {
                    const slugData = await retryRes.json();
                    if (slugData.transfer_accepted) {
                        setLocalTransferData({
                            transfer_accepted: true,
                            transfer_bank: slugData.transfer_bank,
                            transfer_clabe: slugData.transfer_clabe,
                            transfer_name: slugData.transfer_name
                        });
                        setCanPay(true);
                        return;
                    }
                 }
            }
        } catch (slugErr) {
             console.error("[ChatWindow] Error fetching supplier by slug:", slugErr);
        }
    }

    // 2. Fallback: Fetch by User ID if slug failed or wasn't provided
    if (!supplierId) return;
    
    try {
        // console.log("[ChatWindow] Fetching extra supplier details by User ID:", supplierId);
        const suppRes = await fetchWithAuth(`/api/users/${supplierId}`);
        if (suppRes.ok) {
            const suppData = await suppRes.json();
            
            let transferData = {
                transfer_accepted: suppData.transfer_accepted,
                transfer_bank: suppData.transfer_bank,
                transfer_clabe: suppData.transfer_clabe,
                transfer_name: suppData.transfer_name
            };

            // If we have a slug but missing transfer details, try fetching the specific supplier endpoint
            // This matches the user's suggestion to use /suppliers/{slug}
            if (suppData.slug && (!transferData.transfer_bank || !transferData.transfer_clabe)) {
                // console.log(`[ChatWindow] Fetching detailed supplier info from /api/suppliers/${suppData.slug}`);
                try {
                    const slugRes = await fetchWithAuth(`/api/suppliers/${suppData.slug}`);
                    if (slugRes.ok) {
                        const slugData = await slugRes.json();
                        // Merge transfer details
                        transferData = {
                            ...transferData,
                            transfer_accepted: slugData.transfer_accepted ?? transferData.transfer_accepted,
                            transfer_bank: slugData.transfer_bank ?? transferData.transfer_bank,
                            transfer_clabe: slugData.transfer_clabe ?? transferData.transfer_clabe,
                            transfer_name: slugData.transfer_name ?? transferData.transfer_name
                        };
                        // console.log("[ChatWindow] Updated transfer data from slug endpoint:", transferData);
                    }
                } catch (err) {
                    console.warn("Failed to fetch from supplier slug endpoint", err);
                }
            }
            
            if (transferData.transfer_accepted) {
                setCanPay(true);
                // Update local transfer data with fetched details
                setLocalTransferData(transferData);
            }
        }
    } catch (e) {
        console.warn("Could not fetch extra supplier details", e);
    }
  };

  useEffect(() => {
    // Check if we need to fetch details: if we are client, and (canPay is false OR missing details)
    const hasDetails = localTransferData?.transfer_clabe || localTransferData?.transfer_bank;
    if (user?.role === 'client' && (!canPay || !hasDetails)) {
        fetchSupplierDetails();
    }
  }, [supplierId, user, canPay, localTransferData]);


  const handlePaymentClick = async () => {
    if (!user?.role) {
       console.error("User role not found");
       return;
    }

    let targetSlug = supplierSlug;

    if (!targetSlug && supplierId) {
        try {
            const suppRes = await fetchWithAuth(`/api/users/${supplierId}`);
            if (suppRes.ok) {
                const suppData = await suppRes.json();
                targetSlug = suppData.slug;
            }
        } catch (e) {
            console.error("Failed to fetch supplier slug", e);
        }
    }

    if (!targetSlug) {
        setError("No se pudo identificar al proveedor para el pago.");
        return;
    }

    const targetSupplierId = supplierId;
    const targetProductId = productId;

    if (!targetSupplierId || !targetProductId) {
        console.error("Missing supplier or product info for order creation");
        setError("Error: Información del proveedor o producto incompleta.");
        return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
        let targetConversationId = activeConversation?.id;

        if (!targetConversationId) {
            try {
                const newConv = await chatService.createConversation({
                    supplier_id: Number(targetSupplierId),
                    product_id: String(targetProductId)
                });
                targetConversationId = newConv.id;
                setActiveConversation(newConv);
            } catch (err) {
                console.error("Failed to create conversation for order:", err);
                setError("Error: No se pudo iniciar la conversación para el pedido.");
                setIsCreatingOrder(false);
                return;
            }
        }

        const payload = {
            supplier_id: Number(targetSupplierId),
            product_id: String(targetProductId),
            conversation_id: String(targetConversationId),
            status: "pending"
        };

        console.log("Creating order from ChatWindow with payload:", payload);

        const res = await fetchWithAuth('/api/orders/', {
             method: 'POST',
             body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Order creation response (ChatWindow):", data);

        if (!res.ok) {
            console.error("Failed to create order from ChatWindow:", data);
            setError(data.message || data.error || "No se pudo iniciar el proceso de pago. Intenta de nuevo.");
            setIsCreatingOrder(false);
            return;
        }

        setCreatedOrderId(data.id || data.order_id || null);

        const amount = productPrice || 0;
        router.push(`/payment-info?slug=${targetSlug}&amount=${amount}&order_id=${data.id || data.order_id || ''}`);
    } catch (error) {
        console.error("Error creating order from ChatWindow", error);
        setError("Error al procesar la solicitud de pago. Verifica tu conexión.");
    } finally {
        setIsCreatingOrder(false);
    }
  };

  const sendClientProductContext = async () => {
    if (isVendorMode) return;
    if (loading || contextSentRef.current) return;

    try {
      let targetConvId = activeConversation?.id;
      if (!targetConvId && supplierId) {
        const newConv = await chatService.createConversation({
          supplier_id: Number(supplierId),
          product_id: String(productId),
        });
        setActiveConversation(newConv);
        targetConvId = newConv.id;
        setConversations((prev) => [newConv, ...prev]);
      }

      if (targetConvId && !String(targetConvId).startsWith("temp-")) {
        contextSentRef.current = true;
        await chatService.sendMessage(
          targetConvId,
          " ",
          "text",
          undefined,
          productId ?? undefined
        );
        loadMessages(targetConvId);
      }
    } catch (err) {
      console.error("[ChatWindow] Failed to send context message", err);
    }
  };

  const handleCreateOrderAsSupplier = async (msg: Message) => {
    if (!msg?.product || !activeConversation) return;

    const productKey = String((msg as any).product_id || (msg.product as any).id);
    if (supplierOrderByProductId[productKey]) return;

    setIsCreatingOrderAsSupplier(true);
    setError(null);
    try {
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        );

      const pickUuid = (...values: unknown[]) => {
        for (const v of values) {
          if (v && isUuid(String(v))) return String(v);
        }
        return "";
      };

      const history =
        pickUuid((msg as any).conversation_id) && pickUuid((msg as any).product_id)
          ? null
          : await chatService.getMessages(activeConversation.id);

      const msgForIds =
        history?.find((m) => pickUuid((m as any).conversation_id) && (m as any).supplier_id) ||
        history?.[0] ||
        msg;

      const conversationIdToSend = pickUuid(
        (msgForIds as any).conversation_id,
        (msg as any).conversation_id
      );
      const productIdToSend = pickUuid(
        (msg as any).product_id,
        (msg.product as any).id,
        (msgForIds as any).product_id
      );

      const supplierIdToSend = Number((msgForIds as any).supplier_id || (msg as any).supplier_id);

      if (!conversationIdToSend) {
        setError("No se pudo identificar el conversation_id (UUID) para crear la orden.");
        return;
      }
      if (!productIdToSend) {
        setError("No se pudo identificar el product_id (UUID) para crear la orden.");
        return;
      }
      if (!supplierIdToSend || !Number.isFinite(supplierIdToSend)) {
        setError("No se pudo identificar el supplier_id para crear la orden.");
        return;
      }

      const rawPrice = (msg.product as any).price;
      const amountNumber =
        typeof rawPrice === "number"
          ? rawPrice
          : typeof rawPrice === "string"
            ? Number(rawPrice.replace(/[^0-9.]/g, ""))
            : 0;
      const totalAmountToSend = Number.isFinite(amountNumber)
        ? amountNumber.toFixed(2)
        : "0.00";

      const payload = {
        supplier_id: supplierIdToSend,
        product_id: productIdToSend,
        total_amount: totalAmountToSend,
        payment_status: "pending",
        receipt_url: "",
        conversation_id: conversationIdToSend,
      };

      const res = await fetchWithAuth("/api/orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          (data as any)?.detail ||
            (data as any)?.message ||
            (data as any)?.error ||
            "No se pudo crear la orden."
        );
        return;
      }

      const orderId = (data as any)?.id || (data as any)?.order_id || Date.now();
      setSupplierOrderByProductId((prev) => {
        const next = { ...prev, [productKey]: orderId };
        writeSupplierOrdersToStorage(user?.id, next);
        return next;
      });
    } catch (err) {
      setError("No se pudo crear la orden. Verifica tu conexión.");
    } finally {
      setIsCreatingOrderAsSupplier(false);
    }
  };

  // Logic moved to top

  const handleRatingSubmit = async () => {
    if (ratingValue === 0) {
        setError("Por favor selecciona una calificación.");
        return;
    }
    
    setIsSubmittingRating(true);
    try {
        const res = await fetchWithAuth(`/api/products/${productId}/ratings`, {
            method: 'POST',
            body: JSON.stringify({
                rating: ratingValue,
                comment: ratingComment,
                product_id: productId
            })
        });
        
        if (res.ok) {
            setIsRatingOpen(false);
            setRatingValue(0);
            setRatingComment("");
            // Optional: Show success message or notification
        } else {
            const data = await res.json();
            setError(data.message || "Error al enviar calificación.");
        }
    } catch (err) {
        console.error("Error submitting rating", err);
        setError("Error de conexión al calificar.");
    } finally {
        setIsSubmittingRating(false);
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Helper to load messages
  const loadMessages = async (conversationId: number | string) => {
    try {
      const history = await chatService.getMessages(conversationId);
      setMessages(history);
      setTimeout(scrollToBottom, 100);
      try {
        await chatService.markAsRead(conversationId);
      } catch (err) {
        console.error("Failed to mark conversation as read", err);
      }
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

                // Auto-seleccionar la conversación más reciente si no hay una activa
                if (finalConversations.length === 0) {
                    setActiveConversation(null);
                } else if (!activeConversation || !finalConversations.find(c => String(c.id) === String(activeConversation.id))) {
                    setActiveConversation(finalConversations[0]);
                    await loadMessages(finalConversations[0].id);
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
                  product_id: productId || undefined
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
              // 1) Si ya existe un mensaje con el mismo ID, lo ignoramos
              if (prev.some(m => m.id === lastMessage.id)) {
                  console.log("[ChatWindow] Duplicate message ignored by ID:", lastMessage.id);
                  return prev;
              }

              // 2) Intentar REEMPLAZAR un mensaje optimista (mismo remitente + contenido similar en ventana corta)
              let replaced = false;
              const realTime = new Date(lastMessage.created_at || "").getTime();

              const updated = prev.map(m => {
                  if (
                      m.sender_id === lastMessage.sender_id &&
                      typeof m.content === "string" &&
                      typeof lastMessage.content === "string" &&
                      m.content.trim() === lastMessage.content.trim()
                  ) {
                      const mTime = new Date(m.created_at || "").getTime();
                      if (!isNaN(realTime) && !isNaN(mTime) && Math.abs(realTime - mTime) < 5000) {
                          replaced = true;
                          return { ...m, ...lastMessage };
                      }
                  }
                  return m;
              });

              if (replaced) {
                  console.log("[ChatWindow] Replaced optimistic message with real one");
                  return updated;
              }

              // 3) Si no se reemplazó nada, añadimos el nuevo mensaje al final
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
                // console.log("[ChatWindow] Updating vendor conversation list from poll");
                return finalConversations;
            });
            
            // Si no hay conversación activa y ahora existen, auto-seleccionar la más reciente
            if (!activeConversation && finalConversations.length > 0) {
                setActiveConversation(finalConversations[0]);
                try { await loadMessages(finalConversations[0].id); } catch {}
            }
            
        } catch (err) {
            // console.warn("[ChatWindow] Failed to poll conversations:", err);
        }
    }, 5000);
    
    return () => clearInterval(pollConvos);
  }, [isOpen, isVendorMode, productId]);

  // Scroll on initial load
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedFile) || !activeConversation || !user) return;

    const messageContent = inputValue;
    const tempId = Date.now(); // Temporary ID for optimistic update
    const currentFile = selectedFile; // Capture current file
    
    // Determine target product context
    // If productId prop is present (we are on a product page), it takes precedence over the conversation's historic product
    const targetProductId = productId 
        ? String(productId) 
        : (activeConversation.product_id || (activeConversation as any).product?.id);

    // Create optimistic message
    const optimisticMessage: Message & { file?: File } = {
        id: tempId,
        conversation_id: activeConversation.id,
        sender_id: Number(user.id),
        content: currentFile ? URL.createObjectURL(currentFile) : messageContent,
        created_at: new Date().toISOString(),
        is_read: false,
        message_type: currentFile && currentFile.type.startsWith('image/') ? 'image' : (currentFile ? 'file' : 'text'),
        file: currentFile || undefined
    };

    setInputValue(""); // Clear input immediately
    setSelectedFile(null); // Clear file selection
    
    // Add optimistic message to UI
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 50);

    // Check if we need to update conversation product context
    if (targetProductId && String(targetProductId) !== String(activeConversation.product_id)) {
        console.log(`[ChatWindow] Updating conversation context to product: ${targetProductId}`);
        // We update the backend context before/while sending
        // Note: chatService.sendMessage also takes product_id which can handle this, 
        // but explicit update ensures consistency even for WS.
        try {
            await chatService.updateConversation(activeConversation.id, { product_id: targetProductId });
            // Update local state
            setActiveConversation(prev => prev ? ({ ...prev, product_id: targetProductId }) : null);
        } catch (err) {
            console.error("Failed to update conversation context", err);
        }
    }

    // Case 1: File Upload (Must use REST)
    if (currentFile) {
         try {
             // Determine type
             const type = currentFile.type.startsWith('image/') ? 'image' : 'file';
             
             const sentMessage = await chatService.sendMessage(
                activeConversation.id, 
                messageContent, 
                type as any, 
                currentFile,
                targetProductId
             );
             
             // Replace optimistic message with real message
             setMessages(prev => prev.map(m => m.id === tempId ? sentMessage : m));
             return;
         } catch (err) {
             console.error("File upload failed", err);
             setError("Error al enviar archivo.");
             setMessages(prev => prev.filter(m => m.id !== tempId));
             setInputValue(messageContent);
             setSelectedFile(currentFile);
             return;
         }
    }

    // Case 2: New Conversation (No ID or Temporary ID)
    if (String(activeConversation.id).startsWith('temp-') || activeConversation.id === 0) {
        try {
            console.log("Creating conversation before sending message...");
            const newConv = await chatService.createConversation({
                supplier_id: activeConversation.supplier_id,
                product_id: targetProductId || undefined
            });
            
            // Update active conversation with real ID immediately
            const realConv = { ...activeConversation, ...newConv, product_id: targetProductId };
            setActiveConversation(realConv);
            
            // Update messages list to point to new conversation ID
            setMessages(prev => prev.map(m => ({ ...m, conversation_id: newConv.id })));
            
            // Send message with REAL ID via WebSocket
            if (status === 'connected') {
                wsSendMessage(messageContent, newConv.id);
            } else {
                // If not connected, fallback to REST or Queue
                // Ideally queue, but for now try REST as fallback for reliability on creation
                 try {
                    await chatService.sendMessage(newConv.id, messageContent, 'text', undefined, targetProductId);
                 } catch (e) {
                     console.warn("Failed to send initial message via REST, queueing for WS", e);
                     setPendingMessages(prev => [...prev, messageContent]);
                 }
            }
            return;
        } catch (err) {
            console.error("Failed to create conversation:", err);
            setError("Error al iniciar la conversación.");
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInputValue(messageContent);
            return;
        }
    }

    // Attempt 2: WebSocket (Preferred and ONLY supported method as per chat.md)
    if (status === 'connected') {
        try {
            // WS currently doesn't support product_id in payload usually, 
            // but we already updated context via updateConversation above.
            wsSendMessage(messageContent, activeConversation.id);
            // We rely on WS echo to confirm message.
            return;
        } catch (wsErr) {
            console.error("WebSocket send failed", wsErr);
            // Queue the message if immediate send fails
            setPendingMessages(prev => [...prev, messageContent]);
            return;
        }
    } else {
        console.warn("WebSocket is not connected. Status:", status);
        // Fallback to REST if WS disconnected? Or queue?
        // Let's try REST as fallback with product_id
        try {
             await chatService.sendMessage(activeConversation.id, messageContent, 'text', undefined, targetProductId);
             // Remove optimistic message as REST returns the real one? 
             // Actually sendMessage returns the message. 
             // But we already added optimistic. 
             // Ideally we replace it. But for now let's just let it be.
             return;
        } catch (restErr) {
             console.error("REST fallback failed", restErr);
             setPendingMessages(prev => [...prev, messageContent]);
             return;
        }
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

  // Payment Button Logic
  // Show button if user is client. 
  // Disable if supplier doesn't accept transfers or if we are creating order.
  const isModal = mode === 'modal';

  return (
    <div className={isModal ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" : "h-full w-full"}>
      <div className={isModal ? "bg-white w-full h-full sm:max-w-5xl sm:h-[80vh] sm:rounded-2xl shadow-2xl flex overflow-hidden border border-gray-100" : "flex h-full flex-col bg-white"}>
        
        {/* Left: Conversations List (Visible for Vendor or if multiple chats exist) */}
        {isModal && (isVendorMode || conversations.length > 0) && (
          <div className="hidden md:flex w-72 border-r bg-white flex-col shrink-0 h-full overflow-hidden">
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
                              {getChatName(conv).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-gray-800 truncate">
                                {getChatName(conv)}
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

        {/* Center: Chat Area (Facebook Style) */}
        <div className="flex-1 flex flex-col bg-white min-w-0 h-full overflow-hidden relative">
          {/* Header */}
          <div 
            className={`bg-white px-4 py-3 border-b border-gray-200 shadow-sm z-10 flex items-center justify-between h-[68px] shrink-0 ${mode === 'docked' ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            onClick={(e) => {
                if (mode === 'docked' && onMinimize) {
                    if (!(e.target as HTMLElement).closest('button')) {
                        onMinimize();
                    }
                }
            }}
          >


            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold shrink-0 text-lg overflow-hidden">
                    {/* Avatar Logic */}
                    {(isVendorMode ? activeConversation?.user_image : activeConversation?.supplier_image) ? (
                        <img src={isVendorMode ? activeConversation?.user_image : activeConversation?.supplier_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-gray-500 font-bold text-lg">
                            {(activeConversation 
                                ? getChatName(activeConversation)
                                : (productData.title || 'P')).charAt(0).toUpperCase()}
                        </span>
                    )}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${
                    activeConversation
                      ? (status === 'connected'
                          ? 'bg-green-500'
                          : status === 'connecting'
                            ? 'bg-yellow-500'
                            : 'bg-red-500')
                      : 'bg-gray-300'
                  }`}></div>
              </div>
              
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="font-semibold text-[17px] text-gray-900 leading-tight truncate">
                    {activeConversation 
                        ? getChatName(activeConversation)
                        : 'Chat del Producto'}
                </h3>
                <p className={`text-[12px] leading-none mt-0.5 ${
                    !activeConversation
                      ? 'text-gray-400'
                      : status === 'connected'
                        ? 'text-gray-500'
                        : status === 'connecting'
                          ? 'text-yellow-600'
                          : 'text-red-500'
                }`}>
                    {!activeConversation
                      ? 'Preparando chat...'
                      : status === 'connected'
                        ? 'Activo ahora'
                        : status === 'connecting'
                          ? 'Conectando...'
                          : status === 'error'
                            ? 'Chat no disponible'
                            : 'Sin conexión, reintentando...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
               <button 
                  onClick={(e) => { e.stopPropagation(); onClose(); }} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500" 
                  title="Cerrar"
               >
                  <X size={24} />
               </button>
            </div>
          </div>
          
          {/* Error Banner (solo mensajes importantes, sin icono duplicado) */}
          {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 text-sm flex items-center justify-between shrink-0 border-b border-red-100 animate-in slide-in-from-top-2 z-10">
                  <span className="flex items-center gap-2">
                      {error}
                  </span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 p-1" aria-label="Cerrar aviso"><X size={14} /></button>
              </div>
          )}

          {/* Product Context Bar (Sub-header) - HIDDEN for Vendors as requested */}
          {(!isVendorMode && productData?.title) && (
          <div
            className={productSlug ? "px-4 py-2 bg-white border-b border-gray-100 flex items-start gap-3 shrink-0 cursor-pointer hover:bg-gray-50" : "px-4 py-2 bg-white border-b border-gray-100 flex items-start gap-3 shrink-0"}
            onClick={async () => {
              await sendClientProductContext();
            }}
          >
                {!isVendorMode && (
                <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                        {productData?.image ? (
                            <img src={getAbsoluteUrl(productData.image)} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs text-gray-400">IMG</span>
                        )}
                </div>
                )}
                <div className="flex flex-col min-w-0">
                    {!isVendorMode && <span className="text-xs text-gray-500">Producto de interés:</span>}
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[140px] md:max-w-[220px]" title={productData?.title}>
                        {productData?.title}
                    </span>
                </div>
                {!isVendorMode && (
                  <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
                    <div className="text-sm font-bold text-primary">
                      ${Number(productPrice || 0).toLocaleString()}
                    </div>
                    {user?.role === "client" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendClientProductContext();
                        }}
                        disabled={loading || isCreatingOrder}
                        className={`px-3 py-1.5 rounded-full font-medium text-xs transition-colors flex items-center gap-1 shadow-sm ${
                          isCreatingOrder
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-[#168e00] hover:bg-[#137500] text-white"
                        }`}
                      >
                        {isCreatingOrder ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        <span>Solicitar orden</span>
                      </button>
                    )}
                  </div>
                )}
          </div>
        )}


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
                                    {getChatName(activeConversation)}
                                </span>
                            )}
                            
                            <div className={`px-4 py-2 text-[15px] leading-relaxed shadow-sm break-words
                            ${isMe 
                                ? 'bg-[#0084FF] text-white rounded-2xl rounded-tr-md' 
                                : 'bg-[#E4E6EB] text-black rounded-2xl rounded-tl-md'
                            }`}>
                            
                            {/* Product Context Card */}
                            {msg.product && (
                                <div 
                                    className={`mb-2 p-2 rounded-lg border flex items-center gap-2 max-w-[220px] cursor-pointer transition-colors ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (msg.product?.slug) router.push(`/product/${msg.product.slug}`);
                                    }}
                                >
                                    <div className="w-10 h-10 shrink-0 relative rounded overflow-hidden bg-gray-100">
                                        {msg.product.image ? (
                                            <img 
                                                src={getAbsoluteUrl(msg.product.image)} 
                                                alt={msg.product.title} 
                                                className="w-full h-full object-cover" 
                                            />
                                        ) : (
                                            <span className="text-[8px] flex items-center justify-center h-full text-gray-400">IMG</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                         <p className={`text-xs font-bold truncate ${isMe ? 'text-white' : 'text-gray-800'}`}>{msg.product.title}</p>
                                         <p className={`text-xs font-bold ${isMe ? 'text-white/90' : 'text-primary'}`}>${Number(msg.product.price).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                            {isVendorMode && msg.product && (
                              <div className="mb-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateOrderAsSupplier(msg);
                                  }}
                                  disabled={
                                    isCreatingOrderAsSupplier ||
                                    !!supplierOrderByProductId[String((msg as any).product_id || msg.product.id)]
                                  }
                                  className={`px-3 py-1.5 rounded-full font-medium text-xs transition-colors flex items-center gap-1 shadow-sm ${
                                    isCreatingOrderAsSupplier
                                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                      : supplierOrderByProductId[String((msg as any).product_id || msg.product.id)]
                                        ? "bg-[#168e00] text-white cursor-not-allowed opacity-90"
                                        : "bg-[#168e00] hover:bg-[#137500] text-white"
                                  }`}
                                >
                                  {isCreatingOrderAsSupplier ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <PlusCircle size={14} />
                                  )}
                                  <span>
                                    {supplierOrderByProductId[String((msg as any).product_id || msg.product.id)]
                                      ? "Orden creada"
                                      : "Crear nueva orden"}
                                  </span>
                                </button>
                              </div>
                            )}

                            {msg.message_type === 'image' ? (
                                <a 
                                    href={getAbsoluteUrl(msg.attachment_url || msg.content)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block relative w-full h-48 mb-2 rounded-lg overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
                                >
                                    <Image 
                                        src={getAbsoluteUrl(msg.attachment_url || msg.content)} 
                                        alt="Shared image" 
                                        fill 
                                        className="object-cover"
                                    />
                                </a>
                            ) : msg.message_type === 'file' ? (
                                <a 
                                    href={getAbsoluteUrl(msg.attachment_url || msg.content)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors group ${isMe ? 'bg-primary-700/20 border-primary-500/30' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                >
                                    <div className={`p-2 rounded shadow-sm group-hover:scale-110 transition-transform ${isMe ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
                                        <Paperclip size={20} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className={`text-sm font-medium truncate underline decoration-dotted ${isMe ? 'text-white' : 'text-gray-700'}`}>
                                            {(msg as any).file?.name || (msg.attachment_url ? msg.attachment_url.split('/').pop()?.split('?')[0] : msg.content.split('/').pop()?.split('?')[0]) || 'Ver Archivo'}
                                        </span>
                                        <span className={`text-[10px] ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>Clic para descargar</span>
                                    </div>
                                </a>
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

                {/* Input Area */}
                <div className="bg-white border-t shrink-0 flex flex-col p-3 gap-2">
                    {/* Rating Form Overlay/Inline */}
                    {isRatingOpen && (
                        <div className="bg-white absolute bottom-0 left-0 right-0 p-4 border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-800">Calificar Producto</h4>
                                <button onClick={() => setIsRatingOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex justify-center mb-3">
                                <StarRating 
                                    rating={ratingValue} 
                                    interactive={true} 
                                    size={32}
                                    onRatingChange={setRatingValue} 
                                />
                            </div>
                            <textarea
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                placeholder="Escribe tu opinión..."
                                className="w-full border rounded-lg p-2 text-sm mb-3 focus:ring-1 focus:ring-primary outline-none"
                                rows={2}
                            />
                            <button 
                                onClick={handleRatingSubmit}
                                disabled={isSubmittingRating || ratingValue === 0}
                                className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {isSubmittingRating ? <Loader2 className="animate-spin" size={16} /> : "Enviar Calificación"}
                            </button>
                        </div>
                    )}

                    {/* File Preview */}
                    {selectedFile && (
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between animate-in slide-in-from-bottom-2 mb-2 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                {selectedFile.type.startsWith('image/') ? (
                                    <ImageIcon size={16} className="text-primary" />
                                ) : (
                                    <Paperclip size={16} className="text-gray-400" />
                                )}
                                <span className="font-medium">Adjunto:</span>
                                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                                <span className="text-xs text-gray-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-200">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    
                    {/* Text Input - Taller */}
                    <div className="flex-1 bg-[#F0F2F5] rounded-xl px-4 py-2 focus-within:ring-1 focus-within:ring-gray-300 transition-all flex items-start">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={!activeConversation || status !== 'connected'}
                                placeholder={
                                  !activeConversation
                                    ? "Selecciona una conversación..."
                                    : status !== 'connected'
                                      ? "Conectando… espera para enviar"
                                      : "Escribe un mensaje..."
                                }
                                className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none min-h-[60px] max-h-40 text-gray-900 placeholder-gray-500 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed py-1"
                                rows={3}
                            />
                    </div>

                    {/* Toolbar Row */}
                    <div className="flex items-center justify-between mt-1">
                         {/* Left: Icons */}
                         <div className="flex items-center gap-1">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-gray-500 hover:bg-gray-100 hover:text-primary rounded-full transition-colors"
                                title="Adjuntar imagen"
                            >
                                <ImageIcon size={20} />
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedFile(e.target.files[0]);
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">

                             {/* Payment Button (Cliente con datos de transferencia completos) */}
                             {user?.role === 'client' && canPay && localTransferData?.transfer_accepted && (localTransferData.transfer_clabe || localTransferData.transfer_bank) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handlePaymentClick(); }}
                                    className={`px-3 py-1.5 rounded-full font-medium text-xs transition-colors flex items-center gap-1 shadow-sm ${
                                        isCreatingOrder 
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                            : 'bg-[#0084FF] hover:bg-[#0078E7] text-white'
                                    }`}
                                >
                                    {isCreatingOrder ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                    <span>Pagar</span>
                                </button>
                             )}

                            {/* Send Button */}
                            {inputValue.trim() || selectedFile ? (
                                <button 
                                    onClick={handleSend}
                                    disabled={(!inputValue.trim() && !selectedFile) || !activeConversation || status !== 'connected'}
                                    title={status !== 'connected' ? "Esperando conexión con el chat..." : undefined}
                                    className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    <Send size={18} />
                                </button>
                            ) : (
                                <button className="p-2 text-gray-300 rounded-full transition-colors cursor-default">
                                    <Send size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
             </>
          )}
        </div>

      </div>
      
      {/* Payment Modal */}
      {isPaymentModalOpen && localTransferData && (
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
                            <p className="font-medium text-gray-800">{localTransferData.transfer_bank || 'No especificado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Beneficiario</p>
                            <p className="font-medium text-gray-800">{localTransferData.transfer_name || 'No especificado'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CLABE Interbancaria</p>
                            <div className="flex items-center gap-2">
                                <p className="font-mono font-medium text-gray-800 text-lg tracking-wide select-all">
                                    {localTransferData.transfer_clabe || 'No especificado'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Instructions */}
                    <div className="text-xs text-gray-500 bg-blue-50 text-blue-700 p-3 rounded-lg">
                        <p className="font-bold mb-1">Instrucciones:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Realiza la transferencia por el monto exacto.</li>
                            <li>
                                Usa el siguiente ID como concepto de pago:
                                {createdOrderId && (
                                    <span className="block mt-1 font-mono font-bold text-lg bg-blue-100 px-2 py-1 rounded w-fit select-all text-blue-900">
                                        {createdOrderId}
                                    </span>
                                )}
                            </li>
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
