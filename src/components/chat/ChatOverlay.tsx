"use client";

import { useChat } from "@/context/ChatContext";
import ChatWindow from "./ChatWindow";
import { useAuthStore } from "@/store/useAuthStore";
import { X } from "lucide-react";

export function ChatOverlay() {
  const { openChats, closeChat, toggleChat } = useChat();
  const { user } = useAuthStore();

  const getDisplayName = (chat: any) => {
     // 1. Explicit Client Role -> Show Supplier Name
     if (user?.role === 'client') {
         return chat.supplier_name || chat.other_party_name || `Proveedor #${chat.supplier_id}`;
     }

     // 2. ID Match Check
     if (user) {
         const userIdStr = String(user.id);
         const buyerIdStr = String(chat.user_id || chat.buyer_id);
         if (buyerIdStr === userIdStr && user.role !== 'supplier' && user.role !== 'admin') {
             return chat.supplier_name || chat.other_party_name || `Proveedor #${chat.supplier_id}`;
         }
     }

     // 3. Default (Supplier/Admin) -> Show Client Name
      
      // Fix: Prioritize structured user object over flat strings to avoid backend mapping errors
      if (chat.user && (chat.user.name || chat.user.first_name)) {
          return chat.user.name || `${chat.user.first_name || ''} ${chat.user.last_name || ''}`.trim();
      }

      return chat.user_name || chat.buyer_name || `Usuario #${chat.user_id}`;
   };

  if (openChats.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-0 md:right-4 left-0 md:left-auto flex flex-col md:flex-row items-end gap-2 md:gap-4 z-[9999] pointer-events-none p-2 md:p-0">
      {openChats.map((chat, index) => (
        <div 
            key={chat.id} 
            className={`pointer-events-auto bg-white border border-gray-200 rounded-t-xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out flex flex-col
                ${chat.isMinimized ? 'w-full md:w-[200px] h-[48px]' : 'w-full md:w-[340px] h-[500px] md:h-[480px] max-h-[80vh]'}
                ${index === openChats.length - 1 ? 'flex' : 'hidden md:flex'}
            `}
        >
             {chat.isMinimized ? (
                 <div 
                    className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 cursor-pointer h-full border-t-4 border-t-primary"
                    onClick={() => toggleChat(chat.id)}
                 >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getDisplayName(chat).charAt(0)}
                        </div>
                        <span className="font-semibold text-sm truncate">
                            {getDisplayName(chat)}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); closeChat(chat.id); }}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                    >
                        <X size={14} />
                    </button>
                 </div>
             ) : (
                 <ChatWindow 
                    productId={chat.product_id || null}
                    supplierId={chat.supplier_id}
                    supplierName={chat.supplier_name || chat.other_party_name}
                    supplierSlug={chat.supplier_slug}
                    isOwner={String(user?.id) === String(chat.supplier_id) || user?.role === 'admin'}
                    productData={{
                        title: chat.product_title || "Producto",
                        // Backend contract: conversation.product_price ya viene calculado
                        price: typeof chat.product_price === "number" 
                          ? chat.product_price 
                          : Number(chat.product_price) || 0,
                        image: chat.product_image || "",
                        slug: chat.product_slug
                    }}
                    supplierTransferData={chat.supplier_transfer_data || {
                        transfer_accepted: true 
                    }}
                    isOpen={true} 
                    onClose={() => closeChat(chat.id)}
                    onMinimize={() => toggleChat(chat.id)}
                    mode="docked"
                 />
             )}
        </div>
      ))}
    </div>
  );
}
