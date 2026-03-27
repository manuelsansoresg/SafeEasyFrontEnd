"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { registerInteraction, getSimilarProducts } from "@/lib/interactions";
import { ProductCard } from "@/components/ProductCard";
import StarRating from "@/components/StarRating";
import LoginModal from "@/components/LoginModal";
import { 
  MessageCircle, 
  Truck, 
  Check, 
  CheckCircle,
  ShieldCheck, 
  Play, 
  ZoomIn, 
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  CreditCard,
  Store,
  Heart
} from "lucide-react";
import Link from "next/link";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { cn } from "@/lib/utils";
import DOMPurify from "isomorphic-dompurify";

// Interfaces
interface ProductMedia {
  id: number;
  product_id: string;
  type: "image" | "video";
  filename: string;
  path: string;
  url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  position: number;
}

interface Rating {
  id: number;
  rating: number;
  comment: string;
  user_id?: number;
  product_id: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface ProductDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  supplier?: {
    id: number;
    first_name: string;
    last_name: string;
    name?: string;
    email?: string;
    slug?: string;
    logo?: string | null;
    is_verified?: boolean;
    transfer_clabe?: string | null;
    transfer_bank?: string | null;
    transfer_name?: string | null;
    transfer_accepted?: boolean;
  };
  category_id: number;
  subcategory_id: number;
  slug: string;
  average_rating: number;
  image: string | null;
  thumbnail_url: string | null;
  category: {
    id: number;
    name: string;
    description: string;
    icon: string | null;
    is_active: boolean;
    slug: string;
  };
  subcategory: {
    id: number;
    name: string;
    category_id: number;
    is_active: boolean;
    slug: string;
    image: string | null;
    thumbnail_url: string | null;
  };
  media: ProductMedia[];
  ratings: Rating[];
}

const sanitizeHtml = (html: string) => {
  if (!html) return "";
  return DOMPurify.sanitize(html);
};

import { useChat } from "@/context/ChatContext";
import { useChatStore } from "@/store/useChatStore";
import { chatService } from "@/services/chatService";
import { Conversation } from "@/types/chat";

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { openChat, openChats } = useChat();
  const { conversations, fetchConversations } = useChatStore();
  const { toggleFavorite, isFavorite, syncFavorites } = useFavoritesStore();
  const { user, token } = useAuthStore();
  
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const productViewSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    fetchConversations();
  }, [token, fetchConversations]);

  // Update open chat context when viewing a product
  useEffect(() => {
    if (!product || !openChats || openChats.length === 0) return;

    const existingChat = openChats.find(c => 
        String(c.supplier_id) === String(product.supplier_id)
    );

    if (existingChat) {
        // If the chat is open/minimized but has a different product context, update it.
        // This ensures that if the user refreshes or navigates, the chat reflects the current product.
        if (String(existingChat.product_id) !== String(product.id)) {
            console.log(`[ProductPage] Updating chat context to product: ${product.id}`);
            openChat({
                ...existingChat,
                product_id: product.id,
                product_title: product.title,
                product_image: product.thumbnail_url || product.image || undefined,
                product_price: product.price,
                product_slug: product.slug
            });
        }
    }
  }, [product, openChats, openChat]);

  useEffect(() => {
    if (product?.id) {
        registerInteraction({
            product_id: product.id,
            interaction_type: 'view'
        });
    }
  }, [product?.id]);

  useEffect(() => {
    const id = product?.id;
    if (!id) return;
    const key = String(id);
    if (productViewSentRef.current.has(key)) return;
    productViewSentRef.current.add(key);

    const encodedId = encodeURIComponent(key);
    const tryUrls = [
      `/api/products/${encodedId}/views`,
      `/api/products/${encodedId}/views/`,
      `/api/v1/products/${encodedId}/views`,
      `/api/v1/products/${encodedId}/views/`,
      `/api/api/v1/products/${encodedId}/views`,
      `/api/api/v1/products/${encodedId}/views/`,
    ];

    (async () => {
      for (const url of tryUrls) {
        try {
          const res = await fetch(url, { method: "POST" });
          if (res.ok) break;
          if (res.status === 404 || res.status === 405) continue;
          break;
        } catch {
          break;
        }
      }
    })();
  }, [product?.id]);

  useEffect(() => {
    if (slug) {
        getSimilarProducts(slug).then((data) => {
          if (data && data.length > 0) {
            syncFavorites(data);
            setSimilarProducts(data);
          }
        });
    }
  }, [slug, syncFavorites]);

  // Rating State
  const [userRating, setUserRating] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug, token]);

  const checkUserRating = async (forceFetch = false, preserveInput = false) => {
    if (!user || !product) return null;

    let foundRating = null;
    const targetUserId = user.id;

    // Helper to check if a rating belongs to the current user
    const isUserRating = (r: any) => {
        // 1. Check by ID if available
        const rUserId = r.user_id ?? r.user?.id ?? r.userId;
        if (rUserId && String(rUserId) === String(targetUserId)) {
            return true;
        }
        
        // 2. Fallback: Check by name (risky but necessary if IDs are stripped)
        if (r.user_name && user) {
            const userName = String(r.user_name).toLowerCase().trim();
            // Check against various possible user name fields
            const currentName = String(user.name || '').toLowerCase().trim();
            const currentFirstName = String((user as any).first_name || '').toLowerCase().trim();
            const currentUsername = String((user as any).username || '').toLowerCase().trim();
            
            // Debug name matching if needed
            // console.log(`[Debug] Checking name: ${userName} vs ${currentName} / ${currentFirstName}`);

            if ((currentName && userName === currentName) || 
                (currentFirstName && userName === currentFirstName) || 
                (currentUsername && userName === currentUsername)) {
                console.log(`[Debug] Matched rating by name: ${r.user_name}`);
                return true;
            }
        }
        return false;
    };
    
    // 1. Try to find in the already loaded product ratings (unless forced)
    if (!forceFetch && product.ratings && product.ratings.length > 0) {
        foundRating = product.ratings.find(isUserRating);
    }

    // 2. If not found, fetch specifically via product details refetch
    if (!foundRating) {
        try {
            console.log(`[Debug] Checking for existing rating via API for user ${targetUserId} on product ${product.id}...`);
            
            // Refetch full product details to get fresh ratings list
            // Use slug for better reliability if ID fails or is inconsistent
            const res = await fetchWithAuth(`/api/products/${encodeURIComponent(slug)}`);
            
            if (res.ok) {
                const productData = await res.json();
                const ratings = Array.isArray(productData.ratings) ? productData.ratings : [];
                console.log(`[Debug] Refetched product details. Found ${ratings.length} ratings.`);
                
                if (ratings.length > 0) {
                    foundRating = ratings.find(isUserRating);
                    
                    if (foundRating) {
                        console.log("[Debug] Found rating in refetched product data:", foundRating);
                    } else {
                        console.warn("[Debug] Rating still not found in fresh product data.");
                        // Debug logs to see what we have
                        console.log("[Debug] Available Ratings Data (First 3):", JSON.stringify(ratings.slice(0, 3))); 
                    }
                }
            } else {
                console.error("[Debug] Failed to refetch product details:", res.status);
            }

        } catch (err) {
            console.error("Error fetching user rating:", err);
        }
    }

    if (foundRating) {
        console.log("Found user rating:", foundRating);
        setUserRating(foundRating);
        if (!preserveInput) {
            setRatingValue(foundRating.rating);
            setComment(foundRating.comment);
        }
        return foundRating;
    } else {
        if (!preserveInput) {
            console.log("No user rating found.");
            setUserRating(null);
            setRatingValue(0);
            setComment("");
        }
        return null;
    }
  };

  useEffect(() => {
     checkUserRating();
  }, [user, product]);

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user) return;

    setIsSubmittingRating(true);
    setRatingError(null);
    setRatingSuccess(false);

    try {
        const payload = {
            rating: ratingValue,
            comment: comment,
            product_id: product.id,
            user_id: user.id,
            is_approved: true
        };

        console.log("Submitting rating payload:", payload);

        let res;
        if (userRating) {
            // Edit existing rating
            console.log("Updating rating:", payload);
            res = await fetchWithAuth(`/api/products/${product.id}/ratings/${userRating.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Create new rating
            console.log("Creating rating:", payload);
            res = await fetchWithAuth(`/api/products/${product.id}/ratings`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`API Error (${res.status} ${res.statusText}):`, errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                // If parsing fails, use text
                throw new Error(`Error ${res.status}: ${res.statusText}`);
            }
            
            // Handle nested backend_response (common in proxy/gateway errors)
            let detailedMessage = errorData?.detail || errorData?.message;
            
            if (errorData?.backend_response) {
                try {
                    const backendResp = JSON.parse(errorData.backend_response);
                    if (backendResp.detail) {
                        detailedMessage = backendResp.detail;
                    }
                } catch (e) {
                    console.warn("Could not parse backend_response", e);
                }
            }

            // Translate common English errors
            if (detailedMessage === "You have already rated this product") {
                console.log("Duplicate rating detected. Attempting to recover...");
                const found = await checkUserRating(true, true); // Force fetch, preserve input
                
                if (found) {
                    console.log("Found missing rating ID:", found.id, "Retrying as update...");
                    // Retry as PUT
                    const retryRes = await fetchWithAuth(`/api/products/${product.id}/ratings/${found.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    
                    if (retryRes.ok) {
                        const retryData = await retryRes.json();
                        setUserRating(retryData);
                        setRatingSuccess(true);
                        await fetchProduct();
                        return; // Exit successfully
                    } else {
                         // If retry fails, fall through to error
                         const retryText = await retryRes.text();
                         console.error("Retry update failed:", retryRes.status, retryText);
                    }
                } else {
                    console.error("Auto-recovery failed: Could not find user rating ID despite 400 error.");
                }
                
                detailedMessage = found 
                    ? "Encontramos tu calificación anterior pero ocurrió un error al actualizarla. Intenta de nuevo."
                    : "Ya tenías una calificación, pero no pudimos recuperarla para editarla. Por favor contacta a soporte.";
            }

            throw new Error(detailedMessage || "Error al guardar la calificación");
        }

        const data = await res.json();
        setUserRating(data);
        setRatingSuccess(true);
        // Refresh product to update average rating and reviews list
        await fetchProduct(); 

    } catch (err) {
        console.error("Full error object:", err);
        setRatingError(err instanceof Error ? err.message : "No se pudo guardar tu calificación.");
    } finally {
        setIsSubmittingRating(false);
    }
  };

  const fetchProduct = async () => {
    try {
      // Use local proxy to avoid CORS and ensure correct backend targeting
      const baseUrl = '/api';
      console.log(`[ProductDetail] Fetching slug: ${slug} from ${baseUrl}`);

      const headers: HeadersInit = { 'Accept': 'application/json' };
      if (token) {
          headers['Authorization'] = `Bearer ${token}`;
      }

      // Strategy 1: Try direct fetch (ID or Slug supported?)
      let res = await fetch(`${baseUrl}/products/${encodeURIComponent(slug)}?ts=${Date.now()}`, {
        headers
      });

      // Retry without token if 401 (e.g. expired token not yet refreshed)
      if (res.status === 401 && token) {
           console.warn("[ProductDetail] Fetch with token failed (401). Retrying without token...");
           // Remove auth header for retry
           const retryHeaders = { 'Accept': 'application/json' };
           res = await fetch(`${baseUrl}/products/${encodeURIComponent(slug)}?ts=${Date.now()}`, {
                headers: retryHeaders
           });
      }
      
      // Strategy 2: If direct fetch fails (404/500), try searching by slug
      if (!res.ok) {
        console.warn(`[ProductDetail] Direct fetch failed (${res.status}). Trying search fallback...`);
        
        // Use the listing endpoint with search
        const searchUrl = `${baseUrl}/products/?search=${encodeURIComponent(slug)}&limit=1`;
        const searchRes = await fetch(searchUrl, {
             headers: { 'Accept': 'application/json' }
        });
        
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            console.log(`[ProductDetail] Search fallback result:`, searchData);

            if (Array.isArray(searchData) && searchData.length > 0) {
                const productSummary = searchData[0];
                // Check slug match to avoid fuzzy search false positives
                if (productSummary.slug === slug) {
                     console.log(`[ProductDetail] Found product by search. ID: ${productSummary.id}. Fetching details...`);
                     // Now fetch details by ID
                     res = await fetch(`${baseUrl}/products/${productSummary.id}?ts=${Date.now()}`, {
                        headers: { 'Accept': 'application/json' }
                     });
                } else {
                     console.warn(`[ProductDetail] Slug mismatch. Expected: ${slug}, Found: ${productSummary.slug}`);
                }
            } else {
                console.warn(`[ProductDetail] Search returned empty list.`);
            }
        } else {
          console.error(`[ProductDetail] Search fallback failed (${searchRes.status}).`);
        }
      }

      // Strategy 3: As a final fallback, fetch product list and find by slug
      if (!res.ok) {
        try {
          console.warn("[ProductDetail] Trying list fallback by slug...");
          const listRes = await fetch(`${baseUrl}/products/?skip=0&limit=1000`, {
            headers: { Accept: "application/json" },
          });

          if (listRes.ok) {
            const listData = await listRes.json();
            const items = Array.isArray(listData)
              ? listData
              : listData.items || listData.results || [];
            const found = (items as any[]).find((p) => p.slug === slug);

            if (found) {
              console.log("[ProductDetail] Found product via list fallback by slug.", found);
              setProduct(found as any);
              return;
            } else {
              console.warn("[ProductDetail] List fallback did not find product with slug:", slug);
            }
          } else {
            console.warn(
              "[ProductDetail] List fallback failed:",
              listRes.status,
              listRes.statusText
            );
          }
        } catch (e) {
          console.error("[ProductDetail] List fallback error:", e);
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error(`[ProductDetail] Final fetch failed. Status: ${res.status}`, errorData);

        let message = "El producto no se pudo cargar en este momento.";

        if (errorData && typeof errorData === "object") {
          const detail =
            errorData.detail ||
            errorData.message ||
            (typeof errorData.backend_response === "string" ? errorData.backend_response : null);

          if (detail && typeof detail === "string") {
            message = `Producto no encontrado (${res.status}). ${detail}`;
          } else if (errorData.status) {
            message = `Producto no encontrado (${errorData.status}).`;
          }
        } else if (res.status === 404) {
          message = "El producto que buscas no existe o ha sido eliminado.";
        } else if (res.status >= 500) {
          message = "Tenemos un problema en el servidor al cargar este producto. Intenta de nuevo más tarde.";
        }

        setError(message);
        setProduct(null);
        return;
      }

      const data = await res.json();
      syncFavorites([data]);
      setProduct(data);
    } catch (err) {
      console.error("[ProductDetail] Error:", err);
      setError(err instanceof Error ? err.message : "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  };

  const getFullImageUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const getMediaList = () => {
    if (!product) return [];
    if (product.media && product.media.length > 0) return product.media;
    
    // Fallback if media is empty but image/thumbnail exists
    if (product.image || product.thumbnail_url) {
       return [{
         id: 0,
         product_id: product.id,
         type: 'image' as const,
         filename: 'main-image',
         path: product.image || product.thumbnail_url || '',
         url: product.image || product.thumbnail_url || '',
         thumbnail_url: product.thumbnail_url,
         is_primary: true,
         position: 0
       }] as ProductMedia[];
    }
    return [];
  };

  const handlePrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaList = getMediaList();
    if (mediaList.length === 0) return;
    setSelectedMediaIndex((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
  };

  const handleNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    const mediaList = getMediaList();
    if (mediaList.length === 0) return;
    setSelectedMediaIndex((prev) => (prev === mediaList.length - 1 ? 0 : prev + 1));
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
        setIsLoginModalOpen(true);
        return;
    }
    if (!product) return;
    
    try {
        await toggleFavorite(product.id);
    } catch (error) {
        console.error("Error toggling favorite", error);
    }
  };

  const handleChatOpen = async () => {
    console.log("handleChatOpen called. Token exists:", !!token);
    if (!token) {
        setIsLoginModalOpen(true);
        return;
    }

    if (!product || !user) return;

    if (!conversations || conversations.length === 0) {
        try {
            await fetchConversations();
        } catch {}
    }

    const getConversationProductId = (c: any) => c?.product_id || c?.product?.id;

    // 1. Search for existing conversation with this supplier
    const exactMatch = conversations.find(c =>
        String(c.supplier_id) === String(product.supplier_id) &&
        String(getConversationProductId(c) || "") === String(product.id)
    );
    const supplierMatch = conversations.find(c =>
        String(c.supplier_id) === String(product.supplier_id)
    );
    const existingConv = exactMatch || supplierMatch;

    if (existingConv) {
        console.log("Found existing conversation:", existingConv);

        openChat({
            ...existingConv,
            product_id: product.id,
            product_title: product.title,
            product_image: product.thumbnail_url || product.image || undefined,
            product_price: product.price,
            product_slug: product.slug
        });
        return;
    }

    // 2. If not found, create a new one
    try {
        console.log("Creating new conversation for supplier:", product.supplier_id);
        // Create conversation with product context
        const newConv = await chatService.createConversation({
            supplier_id: product.supplier_id,
            product_id: product.id
        });
        
        // Refresh global list
        fetchConversations();
        
        // Open the new chat with product context
        openChat({
            ...newConv,
            product_id: product.id,
            product_title: product.title,
            product_image: product.thumbnail_url || product.image || undefined,
            product_price: product.price,
            product_slug: product.slug
        });

    } catch (err) {
        console.error("Failed to create conversation:", err);
        // Fallback: Open temporary (though this might fail if ID is invalid)
        const tempConv: Conversation = {
            id: `temp-${product.id}-${product.supplier_id}`,
            user_id: Number(user.id),
            supplier_id: product.supplier_id,
            product_id: product.id,
            product_title: product.title,
            product_image: product.thumbnail_url || product.image || "",
            product_price: product.price,
            product_slug: product.slug,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            supplier_name: product.supplier ? (product.supplier.name || `${product.supplier.first_name || ''} ${product.supplier.last_name || ''}`.trim()) : 'Proveedor',
            supplier_image: product.supplier?.logo || undefined,
            unread_count: 0,
            my_role: user.role === 'client' ? 'client' : 'supplier',
            other_party_name: product.supplier ? (product.supplier.name || `${product.supplier.first_name || ''} ${product.supplier.last_name || ''}`.trim()) : 'Proveedor'
        };
        openChat(tempConv);
    }
  };

  const handleRatingClick = () => {
    if (!user) {
      setIsLoginModalOpen(true);
    } else {
      const ratingSection = document.getElementById('rating-section');
      if (ratingSection) {
        ratingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-2xl shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Producto no encontrado</h2>
          <p className="text-gray-500 mb-6">{error || "El producto que buscas no existe o ha sido eliminado."}</p>
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-primary hover:bg-primary/90 transition-colors"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const mediaList = getMediaList();
  const currentMedia = mediaList.length > 0 
    ? mediaList[selectedMediaIndex] 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Breadcrumb - Simple version */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center text-sm text-gray-500">
            <Link href="/" className="hover:text-primary">Inicio</Link>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-900 truncate">{product.category?.name}</span>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-100">
            
            {/* Left Column: Media Gallery */}
            <div className="p-6 lg:p-8 space-y-6">
              {/* Main Visualizer */}
              <div 
                className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden group cursor-zoom-in border border-gray-100"
                onClick={() => setIsZoomOpen(true)}
              >
                {currentMedia ? (
                  currentMedia.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video 
                        src={getFullImageUrl(currentMedia.url)} 
                        className="w-full h-full object-contain"
                        controls
                        onClick={(e) => e.stopPropagation()} // Prevent zoom on video click? User said "debe reproducirse igual" but "si le das click se agranda". Maybe separate click targets or just allow zoom.
                      />
                    </div>
                  ) : (
                    <img 
                      src={getFullImageUrl(currentMedia.url)} 
                      alt={product.title}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package size={64} opacity={0.2} />
                  </div>
                )}
                
                {/* Hover overlay for zoom hint */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium shadow-sm flex items-center gap-2">
                    <ZoomIn size={16} />
                    Ampliar
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {mediaList.length > 1 && (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {mediaList.map((media, index) => (
                    <button
                      key={media.id}
                      onClick={() => setSelectedMediaIndex(index)}
                      className={`
                        relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                        ${selectedMediaIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      {media.type === 'video' ? (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Play size={24} className="text-white" />
                        </div>
                      ) : (
                        <img 
                          src={getFullImageUrl(media.url)} 
                          alt={`View ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-black/50 rounded-full flex items-center justify-center">
                           <Play size={8} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-6 lg:p-8 flex flex-col h-full">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                    {product.title}
                  </h1>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <StarRating rating={Number(product.average_rating || 0)} size={20} showCount={true} />
                  <span className="text-sm text-gray-500">({product.average_rating ? Number(product.average_rating).toFixed(1) : '0.0'})</span>
                </div>

                <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-900">SKU:</span>
                    <span className="font-mono">{product.sku}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-1">
                     <span className={`inline-block w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                     <span>{product.stock > 0 ? 'En Stock' : 'Agotado'}</span>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary">
                      ${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-gray-500 font-medium">MXN</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Precio por unidad (IVA incluido)</p>
                </div>

                {/* Stock & Quantity Placeholder (Static for now as requested "elementos que consideres como stock") */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-8">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Disponibilidad:</span>
                      <span className="text-sm font-bold text-gray-900">{product.stock} unidades</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${Math.min((product.stock / 100) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Truck size={16} />
                      <span className="font-medium">Envío disponible a todo México</span>
                    </div>
                  </div>
                </div>

                {/* Supplier Info Link */}
                {product.supplier && product.supplier.slug && (
                  <div className="mb-6 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <Link href={`/empresas/${product.supplier.slug}`} className="flex items-center gap-4 group">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {product.supplier.logo ? (
                          <img 
                            src={product.supplier.logo} 
                            alt={product.supplier.name || 'Proveedor'} 
                            className="w-full h-full object-contain" 
                          />
                        ) : (
                          <Store className="text-gray-400" size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">Vendido por</p>
                        <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors truncate pr-2 flex items-center gap-2">
                          <span className="truncate">{product.supplier.name || "Proveedor"}</span>
                          {product.supplier.is_verified ? (
                            <span className="inline-flex items-center" title="Empresa verificada">
                              <CheckCircle size={14} className="text-[#168e00]" />
                            </span>
                          ) : null}
                          <ChevronRight size={14} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all text-primary" />
                        </h3>
                      </div>
                    </Link>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button 
                    onClick={handleChatOpen}
                    className="flex-1 bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={24} />
                    Chat con Proveedor
                  </button>

                  <button 
                    onClick={handleFavoriteClick}
                    className="px-6 py-4 rounded-xl border-2 border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                    title={product && isFavorite(product.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                  >
                    <Heart 
                        size={24} 
                        className={cn(
                            "transition-colors",
                            product && isFavorite(product.id) ? "fill-primary text-primary" : "text-gray-400 group-hover:text-primary"
                        )} 
                    />
                  </button>
                </div>

                {/* Safety Badges */}
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-green-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Compra Segura</p>
                      <p className="text-xs text-gray-500">Protección al comprador garantizada</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="text-blue-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Calidad Verificada</p>
                      <p className="text-xs text-gray-500">Producto revisado antes del envío</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="border-t border-gray-100 p-6 lg:p-8 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} className="text-primary" />
              Descripción del Producto
            </h3>
            <div className="text-gray-600 w-full">
              <div className="ql-snow w-full">
                <div
                  className="ql-editor"
                  style={{ padding: 0, color: "inherit", fontSize: "inherit", background: "transparent" }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
                />
              </div>
            </div>
          </div>

          {/* Rating Section */}
          {user && (
            <div className="mt-6 border-t border-gray-100 p-6 lg:p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <StarRating rating={userRating ? userRating.rating : 0} size={20} />
                    {userRating ? "Tu Calificación" : "Calificar Producto"}
                </h3>
                
                <form onSubmit={handleRatingSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Puntuación</label>
                        <StarRating 
                            rating={ratingValue} 
                            interactive={true} 
                            size={32} 
                            onRatingChange={setRatingValue} 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Comentario</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            required
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            placeholder="Comparte tu opinión sobre este producto..."
                        />
                    </div>

                    {ratingError && (
                        <div className="text-red-600 text-sm">{ratingError}</div>
                    )}

                    {ratingSuccess && (
                        <div className="text-green-600 text-sm flex items-center gap-2">
                            <Check size={16} />
                            ¡Calificación guardada exitosamente!
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isSubmittingRating || ratingValue === 0}
                        className="bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmittingRating ? (
                            <span className="flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                Guardando...
                            </span>
                        ) : (
                            userRating ? "Actualizar Calificación" : "Enviar Calificación"
                        )}
                    </button>
                </form>
            </div>
          )}

          {/* Reviews List */}
          <div className="mt-8 border-t border-gray-100 pt-8 p-6 lg:p-8">
             <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                Opiniones de clientes
                <span className="text-sm font-normal text-gray-500">({product.ratings?.length || 0})</span>
             </h3>
             
             {product.ratings && product.ratings.length > 0 ? (
                 <div className="space-y-8">
                     {product.ratings.map((rating) => (
                         <div key={rating.id} className="border-b border-gray-100 pb-8 last:border-0 last:pb-0">
                             <div className="flex items-center justify-between mb-3">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 uppercase">
                                         {rating.user_name ? rating.user_name[0] : (rating.user?.first_name ? rating.user.first_name[0] : (rating.user?.email?.[0] || 'U'))}
                                     </div>
                                     <div>
                                         <div className="flex items-center gap-2">
                                             <span className="font-bold text-gray-900 text-sm">
                                                 {rating.user_name || (rating.user ? `${rating.user.first_name || 'Usuario'} ${rating.user.last_name ? rating.user.last_name[0] + '.' : ''}` : 'Usuario')}
                                             </span>
                                            
                                         </div>
                                         <div className="flex items-center gap-2 mt-0.5">
                                            <StarRating rating={rating.rating} size={14} />
                                            <span className="text-xs text-gray-400 font-medium">
                                                {rating.rating.toFixed(1)}
                                            </span>
                                         </div>
                                     </div>
                                 </div>
                                 <span className="text-xs text-gray-400 font-medium">
                                     {new Date(rating.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                                 </span>
                             </div>
                             <p className="text-gray-600 text-sm leading-relaxed pl-[52px]">{rating.comment}</p>
                         </div>
                     ))}
                 </div>
             ) : (
                 <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                     <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                     <p className="text-gray-900 font-medium">No hay opiniones todavía</p>
                     <p className="text-sm text-gray-500">¡Sé el primero en compartir tu experiencia!</p>
                 </div>
             )}
          </div>
        </div>
        {similarProducts.length > 0 && (
          <section className="mt-16 border-t pt-10">
             <h2 className="text-2xl font-bold mb-6 text-gray-800">Productos Similares</h2>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {similarProducts.map((p) => (
                 <ProductCard 
                    key={p.id}
                    id={String(p.id)}
                    title={p.title}
                    price={p.price}
                    image={p.thumbnail_url || ""}
                    minOrder="1 pieza"
                    slug={p.slug}
                    rating={Number(p.average_rating || 0)}
                 />
               ))}
             </div>
          </section>
        )}
      </main>

      {/* Login Modal */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

      {/* Zoom Modal */}
      {isZoomOpen && currentMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setIsZoomOpen(false)}
          >
            <X size={32} />
          </button>
          
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2"
            onClick={handlePrevMedia}
          >
            <ChevronLeft size={48} />
          </button>
          
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2"
            onClick={handleNextMedia}
          >
            <ChevronRight size={48} />
          </button>

          <div 
            className="max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {currentMedia.type === 'video' ? (
              <video 
                src={getFullImageUrl(currentMedia.url)} 
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                controls
                autoPlay
              />
            ) : (
              <img 
                src={getFullImageUrl(currentMedia.url)} 
                alt={product.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] p-2">
             {mediaList.map((media, index) => (
               <button
                 key={media.id}
                 onClick={(e) => { e.stopPropagation(); setSelectedMediaIndex(index); }}
                 className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${selectedMediaIndex === index ? 'border-white scale-110' : 'border-white/30 hover:border-white/70'}`}
               >
                 {media.type === 'video' ? (
                   <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                     <Play size={16} className="text-white" />
                   </div>
                 ) : (
                   <img 
                      src={getFullImageUrl(media.url)} 
                      className="w-full h-full object-cover" 
                   />
                 )}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
